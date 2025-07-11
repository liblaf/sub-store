import { Cacheable } from "@type-cacheable/core";
import {
  type LRUCacheAdapter,
  useAdapter,
} from "@type-cacheable/lru-cache-adapter";
import ky from "ky";
import { LRUCache } from "lru-cache";
import z from "zod/v4";

const client: LRUCache<string, any> = new LRUCache({ max: 8 });
const adaptor: LRUCacheAdapter<any> = useAdapter(client, undefined, {
  excludeContext: false,
});

const SUBCONVERTER_SCHEMA = z.object({
  url: z.url(),
  target: z.string(),
  backend: z.string().default("https://url.v1.mk/sub"),
});
type SubconverterParams = z.input<typeof SUBCONVERTER_SCHEMA>;

export class Fetcher {
  async subconvert(params: SubconverterParams): Promise<string> {
    const { url: origin, target, backend } = SUBCONVERTER_SCHEMA.parse(params);
    const url = new URL(backend);
    url.searchParams.set("url", origin);
    url.searchParams.set("target", target);
    url.searchParams.set("list", "true");
    return await this.fetchText(url);
  }

  @Cacheable({ client: adaptor })
  async fetchText(url: string | URL, ua?: string): Promise<string> {
    const headers = new Headers();
    if (ua) headers.set("User-Agent", ua);
    const text: string = await ky.get(url, { headers }).text();
    return text;
  }
}

export const fetcher = new Fetcher();
