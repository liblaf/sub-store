import { group } from "@/lib/groups";
import type { Group } from "@/lib/groups";
import { inferCountry, inferInfo } from "@/lib/pipeline/infer";
import { nameStripCommonAffixes, namePretty, nameOverride } from "@/lib/pipeline/name";

import type { Profile } from "./profile";
import type { ProviderOptions } from "./provider";
import type { ProxyWrapper } from "./proxy";
import type { Usage } from "./usage";

export type BuildOptions = {
  groups: string[];
  profile: Profile;
  template: string;
};

export type FetchResult<T = unknown> = {
  proxies: ProxyWrapper<T>[];
  usage: Usage;
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

  public async build(): Promise<string> {
    const providers: FetchResult<T>[] = await Promise.all(
      this.profile.providers.map(async (provider: ProviderOptions): Promise<FetchResult<T>> => {
        let { proxies, usage }: FetchResult<T> = await this.fetch(provider);
        proxies = nameStripCommonAffixes(proxies);
        proxies = nameOverride(proxies, provider.override?.["proxy-name"] ?? []);
        // TODO: add info proxies
        proxies = namePretty(proxies, provider.name);
        return { proxies, usage };
      }),
    );
    let proxies: ProxyWrapper<T>[] = providers.flatMap(
      ({ proxies }: FetchResult<T>): ProxyWrapper<T>[] => proxies,
    );
    proxies = inferInfo(proxies);
    proxies = inferCountry(proxies);
    const groups: Group<T>[] = group(proxies, this.groups);
    return await this.render(proxies, groups);
  }

  public abstract fetch(provider: ProviderOptions): Promise<FetchResult<T>>;

  public abstract proxyFromName(name: string): ProxyWrapper<T>;

  public abstract render(proxies: ProxyWrapper<T>[], groups: Group<T>[]): Promise<string>;
}
