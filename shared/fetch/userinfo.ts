import type { Provider } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
import { LocalFetcher } from "./abc";
import { fetchBWCounterDirect } from "./direct/bwcounter";
import { fetchUserinfoDirect } from "./direct/userinfo";
import type { LocalFetchResult } from "./types";

export class UserinfoLocalFetcher extends LocalFetcher<Userinfo> {
  override async fetch(
    provider: Provider,
  ): Promise<LocalFetchResult<Userinfo>> {
    const url: string | undefined = provider.mihomo ?? provider.singbox;
    if (url) return await fetchUserinfoDirect(url);
    if (provider.bwcounter) return await this.fetchFromBWCounter(provider);
    throw new Error(`Provider ${provider.id} does not support userinfo`);
  }

  async fetchFromBWCounter(
    provider: Provider,
  ): Promise<LocalFetchResult<Userinfo>> {
    const url: string = provider.bwcounter!;
    const { userinfo } = await fetchBWCounterDirect(url);
    return { content: userinfo, userinfo };
  }
}
