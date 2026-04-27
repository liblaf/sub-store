import * as _ from "lodash-es";

import { group } from "@/lib/groups";
import type { Group } from "@/lib/groups";
import { inferCountry, inferInfo } from "@/lib/pipeline/infer";
import { nameStripCommonAffixes, namePretty, nameOverride } from "@/lib/pipeline/name";

import type { Profile } from "./profile";
import type { ProviderOptions } from "./provider";
import type { ProxyWrapper } from "./proxy";
import { usageToHeader, usageToProxyNames } from "./usage";
import type { SubscriptionUserinfo } from "./usage";

export type BuildOptions = {
  groups: string[];
  profile: Profile;
  template: string;
};

export type Metadata = {
  date: Date;
  usage?: SubscriptionUserinfo;
};

export type FetchResult<T = unknown> = {
  proxies: ProxyWrapper<T>[];
  metadata: Metadata;
};

export type Artifact = {
  body: string;
  metadata: {
    headers: Record<string, string>;
  };
};

export abstract class Builder<T = unknown> {
  public groups: string[];
  public profile: Profile;
  public template: string;

  public constructor(options: BuildOptions) {
    this.groups = options.groups;
    this.profile = options.profile;
    this.template = options.template;
  }

  public async build(): Promise<Artifact> {
    const providers: FetchResult<T>[] = await Promise.all(
      this.profile.providers.map(async (provider: ProviderOptions): Promise<FetchResult<T>> => {
        let { proxies, metadata }: FetchResult<T> = await this.fetch(provider);
        proxies = nameStripCommonAffixes(proxies);
        proxies = nameOverride(proxies, provider.override?.["proxy-name"] ?? []);
        proxies = this.addMetaProxies(proxies, metadata);
        proxies = namePretty(proxies, provider.name);
        return { proxies, metadata };
      }),
    );
    let proxies: ProxyWrapper<T>[] = providers.flatMap(
      ({ proxies }: FetchResult<T>): ProxyWrapper<T>[] => proxies,
    );
    const metadata: Metadata = mergeMetadata(
      providers.map(({ metadata }: FetchResult<T>): Metadata => metadata),
    );
    proxies = this.addMetaProxies(proxies, metadata);
    proxies = inferInfo(proxies);
    proxies = inferCountry(proxies);
    const groups: Group<T>[] = group(proxies, this.groups);
    const body: string = await this.render(proxies, groups);
    return {
      body,
      metadata: {
        headers: {
          "Subscription-Userinfo": usageToHeader(metadata.usage),
        },
      },
    };
  }

  public abstract fetch(provider: ProviderOptions): Promise<FetchResult<T>>;

  public abstract proxyFromName(name: string): ProxyWrapper<T>;

  public abstract render(proxies: ProxyWrapper<T>[], groups: Group<T>[]): Promise<string>;

  protected addMetaProxies(proxies: ProxyWrapper<T>[], metadata: Metadata): ProxyWrapper<T>[] {
    for (const name of metadataToProxyNames(metadata)) {
      if (proxies.some((proxy: ProxyWrapper<T>): boolean => proxy.name === name)) continue;
      proxies.push(this.proxyFromName(name));
    }
    return proxies;
  }
}

function mergeMetadata(metadataList: Metadata[]): Metadata {
  const date: Date = _.min(metadataList.map((metadata: Metadata): Date => metadata.date))!;
  const usage: SubscriptionUserinfo = {};
  for (const metadata of metadataList) {
    for (const key of ["upload", "download", "total"] as const) {
      if (metadata.usage?.[key]) {
        usage[key] = (usage[key] ?? 0) + metadata.usage[key];
      }
    }
    if (metadata.usage?.expire && (!usage.expire || metadata.usage.expire < usage.expire)) {
      usage.expire = metadata.usage.expire;
    }
  }
  return { date, usage };
}

function* metadataToProxyNames(metadata: Metadata): Generator<string> {
  yield* usageToProxyNames(metadata.usage);
  yield `Updated: ${metadata.date.toLocaleDateString("en-CA")}`;
}
