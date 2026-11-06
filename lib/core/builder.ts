import YAML from "yaml";
import type { ZodType } from "zod";

import { prepareProviderProxies } from "@/lib/pipeline/provider";
import { fetcher, isStaleResponse, subconvert } from "@/lib/utils";

import { assertProfileTarget } from "./profile";
import type { Profile, ProfileTarget } from "./profile";
import type { ProviderOptions } from "./provider";
import { createProxyWrapper } from "./proxy";
import type { ProxyWrapper } from "./proxy";
import type { NativeProxy } from "./template";
import { infoProxyNames, usageFromBwcounter, usageFromHeader, usageToHeader } from "./usage";
import type { SubscriptionUserinfo, Usage } from "./usage";

export type BuildOptions = { profile: Profile };
export type Metadata = { date: Date; usage?: Usage; stale?: boolean };
export type FetchResult<T = unknown> = { proxies: ProxyWrapper<T>[]; metadata: Metadata };
type ProviderSnapshot<T = unknown> = FetchResult<T> & { name: string };

export type Artifact = {
  body: string;
  metadata: { headers: Record<string, string> };
};

export abstract class Builder<T extends NativeProxy> {
  public profile: Profile;
  public abstract readonly target: ProfileTarget;
  protected abstract providerSchema: ZodType<{ proxies: T[] }>;

  public constructor(options: BuildOptions) {
    this.profile = options.profile;
  }

  public async build(): Promise<Artifact> {
    assertProfileTarget(this.profile, this.target);
    const snapshots: ProviderSnapshot<T>[] = await Promise.all(
      Object.entries(this.profile["proxy-providers"]).map(async ([name, provider]) => {
        const { proxies, metadata } = await this.fetch(provider);
        return {
          name,
          proxies: prepareProviderProxies(proxies, provider),
          metadata,
        };
      }),
    );
    const providers = new Map(snapshots.map(({ name, proxies }) => [name, proxies]));
    const infoProxies = snapshots.flatMap(({ name, metadata }) =>
      infoProxyNames(name, metadata.date, metadata.usage, metadata.stale).map((name) =>
        createProxyWrapper({
          info: true,
          name,
          wrapped: this.createInfoProxy(name),
        }),
      ),
    );
    const body = await this.render(providers, infoProxies);
    const header = usageToHeader(
      mergeSubscriptionUserinfo(snapshots.map(({ metadata }) => metadata)),
    );
    const headers: Record<string, string> = {};
    const metadata = this.profile["__sub-store"];
    if (metadata?.name !== undefined) {
      const filename = encodeURIComponent(metadata.name).replace(
        /['()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      headers["Content-Disposition"] = `attachment; filename*=UTF-8''${filename}`;
    }
    if (metadata?.["update-interval"] !== undefined) {
      headers["Profile-Update-Interval"] = String(metadata["update-interval"]);
    }
    if (metadata?.["web-page-url"] !== undefined) {
      headers["Profile-Web-Page-Url"] = new URL(metadata["web-page-url"]).href;
    }
    if (header) headers["Subscription-Userinfo"] = header;
    return { body, metadata: { headers } };
  }

  public async fetch(provider: ProviderOptions): Promise<FetchResult<T>> {
    try {
      return await this.fetchProvider(provider);
    } catch {
      // Upstream and YAML errors can contain subscription credentials or response content.
      throw new Error(`Provider fetch or validation failed: ${new URL(provider.url).origin}`);
    }
  }

  private async fetchProvider(provider: ProviderOptions): Promise<FetchResult<T>> {
    const url =
      provider["__sub-store"]?.format === "mixed"
        ? subconvert("clash", provider.url)
        : provider.url;
    const headers: Record<string, string> = { "User-Agent": "clash.meta" };
    for (const [key, value] of Object.entries(provider.headers ?? {})) {
      for (const previous of Object.keys(headers)) {
        if (previous.toLowerCase() === key.toLowerCase()) delete headers[previous];
      }
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
    const response = await fetcher.fetch(url, { headers }, async (candidate) => {
      this.providerSchema.parse(YAML.parse(await candidate.text()));
    });
    const config = this.providerSchema.parse(YAML.parse(await response.text()));
    const date = new Date(response.headers.get("Date") ?? Date.now());
    const usage =
      usageFromHeader(response.headers.get("Subscription-Userinfo")) ??
      (await usageFromBwcounter(provider["__sub-store"]?.bwcounter));
    return {
      proxies: config.proxies.map((proxy) =>
        createProxyWrapper({ name: proxy.name, wrapped: proxy }),
      ),
      metadata: {
        date,
        usage,
        stale: isStaleResponse(response) || !!(usage && "source" in usage && usage.stale),
      },
    };
  }

  public abstract render(
    providers: ReadonlyMap<string, ProxyWrapper<T>[]>,
    infoProxies: ProxyWrapper<T>[],
  ): Promise<string>;

  protected abstract createInfoProxy(name: string): T;
}

export function unwrapProxies<T extends NativeProxy>(proxies: ProxyWrapper<T>[]): T[] {
  return proxies.map((proxy) => ({ ...proxy.wrapped, name: proxy.pretty }));
}

function mergeSubscriptionUserinfo(metadataList: Metadata[]): SubscriptionUserinfo | undefined {
  const usageList: SubscriptionUserinfo[] = metadataList.flatMap(
    ({ usage }): SubscriptionUserinfo[] => (usage && !("source" in usage) ? [usage] : []),
  );
  if (!usageList.length) return undefined;
  const usage: SubscriptionUserinfo = {};
  for (const key of ["upload", "download", "total"] as const) {
    if (usageList.every((providerUsage) => providerUsage[key] !== undefined)) {
      usage[key] = usageList.reduce((sum, providerUsage) => sum + providerUsage[key]!, 0);
    }
  }
  if (usageList.every(({ expire }) => expire !== undefined)) {
    usage.expire = Math.min(...usageList.map(({ expire }) => expire!));
  }
  return Object.keys(usage).length ? usage : undefined;
}
