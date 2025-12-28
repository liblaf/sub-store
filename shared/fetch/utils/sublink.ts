import type { KyInstance } from "ky";
import ky from "ky";
import type { FetchMihomoResult } from "../inner/mihomo";
import { fetchMihomoDirect } from "../inner/mihomo";

export class Sublink {
  constructor(
    private url: string = process.env.SUB_LINK_URL ??
      "https://sublink.liblaf.me",
    private fetcher?: Fetcher,
  ) {}

  get client(): KyInstance {
    return ky.create({
      fetch: this.fetcher?.fetch,
      prefixUrl: this.url,
      redirect: "follow",
    });
  }

  async clash(url: string): Promise<FetchMihomoResult> {
    const input = new URL(`${this.url}/clash`);
    input.searchParams.set("config", url);
    input.searchParams.set("ua", "clash.meta");
    return await fetchMihomoDirect(input, this.client);
  }
}
