import type { Provider } from "@shared/schema/provider";
import { NotFoundException } from "chanfana";
import { LocalFetcher } from "./abc";
import { fetchMihomoDirect } from "./direct/mihomo";
import type { LocalFetchResult } from "./types";

export class LocalMihomoFetcher extends LocalFetcher<string> {
  override async fetch(provider: Provider): Promise<LocalFetchResult<string>> {
    if (provider.mihomo) {
      return await fetchMihomoDirect(provider.mihomo);
    }
    const url: string | undefined =
      provider.singbox ?? provider.surge ?? provider.xray;
    if (!url) {
      const { id } = provider;
      throw new NotFoundException(`Provider ${id} does not support mihomo`);
    }
    return await this.sublink.clash(url);
  }
}
