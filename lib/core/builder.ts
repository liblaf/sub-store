import { inferCountry } from "@/lib/pipeline/infer";
import { nameStripCommonAffixes, namePretty, nameOverride } from "@/lib/pipeline/name";

import type { Profile } from "./profile";
import type { ProviderOptions } from "./provider";
import type { ProxyWrapper } from "./proxy";
import { createProxyWrapper } from "./proxy";
import { infoProxyNames, usageToHeader } from "./usage";
import type { SubscriptionUserinfo, Usage } from "./usage";

export type BuildOptions = {
  profile: Profile;
  template: string;
};

export type Metadata = {
  date: Date;
  usage?: Usage;
};

export type FetchResult<T = unknown> = {
  proxies: ProxyWrapper<T>[];
  metadata: Metadata;
};

type ProviderSnapshot<T = unknown> = FetchResult<T> & {
  provider: ProviderOptions;
};

export type Artifact = {
  body: string;
  metadata: {
    headers: Record<string, string>;
  };
};

export abstract class Builder<T = unknown> {
  public profile: Profile;
  public template: string;

  public constructor(options: BuildOptions) {
    this.profile = options.profile;
    this.template = options.template;
  }

  public async build(): Promise<Artifact> {
    const providers: ProviderSnapshot<T>[] = await Promise.all(
      this.profile.providers.map(
        async (provider: ProviderOptions): Promise<ProviderSnapshot<T>> => {
          let { proxies, metadata }: FetchResult<T> = await this.fetch(provider);
          proxies = nameStripCommonAffixes(proxies);
          proxies = nameOverride(proxies, provider.override?.["proxy-name"] ?? []);
          proxies = namePretty(proxies, provider.name);
          return { provider, proxies, metadata };
        },
      ),
    );
    let proxies: ProxyWrapper<T>[] = providers.flatMap(
      ({ proxies }: ProviderSnapshot<T>): ProxyWrapper<T>[] => proxies,
    );
    proxies = inferCountry(proxies);
    const infoProxies: ProxyWrapper<T>[] = providers.flatMap(
      ({ provider, metadata }: ProviderSnapshot<T>): ProxyWrapper<T>[] =>
        infoProxyNames(provider.name, metadata.date, metadata.usage).map(
          (name: string): ProxyWrapper<T> =>
            createProxyWrapper({
              info: true,
              name,
              wrapped: this.createInfoProxy(name),
            }),
        ),
    );
    const body: string = await this.render(proxies, infoProxies);
    const header: string = usageToHeader(
      mergeSubscriptionUserinfo(
        providers.map(({ metadata }: ProviderSnapshot<T>): Metadata => metadata),
      ),
    );
    return {
      body,
      metadata: {
        headers: header ? { "Subscription-Userinfo": header } : {},
      },
    };
  }

  public abstract fetch(provider: ProviderOptions): Promise<FetchResult<T>>;

  public abstract render(
    proxies: ProxyWrapper<T>[],
    infoProxies: ProxyWrapper<T>[],
  ): Promise<string>;

  protected abstract createInfoProxy(name: string): T;
}

function mergeSubscriptionUserinfo(metadataList: Metadata[]): SubscriptionUserinfo | undefined {
  const usageList: SubscriptionUserinfo[] = metadataList.flatMap(
    ({ usage }: Metadata): SubscriptionUserinfo[] => (usage && !("source" in usage) ? [usage] : []),
  );
  if (usageList.length === 0) return undefined;

  const usage: SubscriptionUserinfo = {};
  for (const key of ["upload", "download", "total"] as const) {
    if (usageList.every((providerUsage): boolean => providerUsage[key] !== undefined)) {
      usage[key] = usageList.reduce(
        (sum: number, providerUsage: SubscriptionUserinfo): number => sum + providerUsage[key]!,
        0,
      );
    }
  }
  if (usageList.every(({ expire }: SubscriptionUserinfo): boolean => expire !== undefined)) {
    usage.expire = Math.min(
      ...usageList.map(({ expire }: SubscriptionUserinfo): number => expire!),
    );
  }
  return Object.keys(usage).length > 0 ? usage : undefined;
}
