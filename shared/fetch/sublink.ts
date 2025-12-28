import type { KyInstance } from "ky";
import ky from "ky";
import { fetchMihomoDirect } from "./direct/mihomo";
import type { LocalFetchResult } from "./types";

export class Sublink {
  constructor(
    private url: string = process.env.SUBLINK_URL ??
      "https://sublink.liblaf.me",
    private fetcher?: Fetcher,
  ) {}

  get client(): KyInstance {
    return ky.create({
      fetch: this.fetcher?.fetch.bind(this.fetcher),
      prefixUrl: this.url,
      redirect: "follow",
    });
  }

  async clash(url: string): Promise<LocalFetchResult<string>> {
    const input = new URL(`${this.url}/clash`);
    input.searchParams.set("config", url);
    input.searchParams.set("ua", "clash.meta");
    return await fetchMihomoDirect(input, this.client);
  }
}
