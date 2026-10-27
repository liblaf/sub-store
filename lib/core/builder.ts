import YAML from "yaml";
import type { ZodType } from "zod";

import { normalizeProviderProxies } from "@/lib/pipeline/name";
import { fetcher, subconvert } from "@/lib/utils";

import { compilePattern } from "./filter";
import { assertProfileTarget } from "./profile";
import type { Profile, ProfileTarget } from "./profile";
import type { ProviderOptions } from "./provider";
import { createProxyWrapper } from "./proxy";
import type { ProxyWrapper } from "./proxy";
import type { NativeProxy } from "./template";
import { infoProxyNames, usageFromBwcounter, usageFromHeader, usageToHeader } from "./usage";
import type { SubscriptionUserinfo, Usage } from "./usage";

export type BuildOptions = { profile: Profile };
export type Metadata = { date: Date; usage?: Usage };
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
        const sourceNames = proxies.map((proxy) => proxy.name);
        normalizeProviderProxies(proxies, provider);
        const names = new Map(
          sourceNames.map((sourceName, index) => [sourceName, proxies[index]!.name]),
        );
        for (const proxy of proxies) {
          const dialer = proxy.wrapped["dialer-proxy"];
          if (typeof dialer === "string" && names.has(dialer)) {
            proxy.wrapped = { ...proxy.wrapped, "dialer-proxy": names.get(dialer)! };
          }
        }
        const include = provider.filter === undefined ? undefined : compilePattern(provider.filter);
        const exclude =
          provider["exclude-filter"] === undefined
            ? undefined
            : compilePattern(provider["exclude-filter"]);
        const excludedTypes = new Set(
          (provider["exclude-type"] ?? "")
            .split("|")
            .filter(Boolean)
            .map((type) => type.toLowerCase()),
        );
        return {
          name,
          proxies: proxies.filter(
            (proxy) =>
              (!include || include.test(proxy.name)) &&
              !exclude?.test(proxy.name) &&
              !excludedTypes.has(proxy.wrapped.type.toLowerCase()),
          ),
          metadata,
        };
      }),
    );
    const providers = new Map(snapshots.map(({ name, proxies }) => [name, proxies]));
    const infoProxies = snapshots.flatMap(({ name, metadata }) =>
      infoProxyNames(name, metadata.date, metadata.usage).map((name) =>
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
    return { body, metadata: { headers: header ? { "Subscription-Userinfo": header } : {} } };
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
      metadata: { date, usage },
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
