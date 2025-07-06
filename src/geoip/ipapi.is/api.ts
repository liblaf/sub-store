import { Cacheable } from "@type-cacheable/core";
import { LRUCacheAdapter } from "@type-cacheable/lru-cache-adapter";
import ky from "ky";
import { LRUCache } from "lru-cache";
import * as R from "remeda";
import z from "zod/v4";
import type { APIBulkResponse, APIResponse } from "./schema";

const cache = new LRUCache<string, APIResponse>({ max: 1024 });
const client: LRUCacheAdapter<APIResponse> = new LRUCacheAdapter(cache);

const API_OPTIONS_SCHEMA = z.object({
  key: z.string(),
  url: z.url().default("https://api.ipapi.is/"),
  maxBulkSize: z.int().positive().default(100),
});

export type APIOptions = z.input<typeof API_OPTIONS_SCHEMA>;

export class API {
  key: string;
  url: string;
  maxBulkSize: number;

  constructor(params: APIOptions) {
    const { key, url, maxBulkSize } = API_OPTIONS_SCHEMA.parse(params);
    this.key = key;
    this.url = url;
    this.maxBulkSize = maxBulkSize;
  }

  @Cacheable({
    cacheKey(args: any[], _context?: any): string {
      const ip = args[0] as string;
      return ip;
    },
    client,
  })
  async lookup(ip: string): Promise<APIResponse> {
    const url = new URL(this.url);
    const result = (await ky
      .get(url, {
        searchParams: { q: ip, key: this.key },
      })
      .json()) as APIResponse;
    return result;
  }

  async bulk(ips: string[]): Promise<APIBulkResponse> {
    ips = R.unique(ips);
    const cacheResults: Record<string, APIResponse | undefined> =
      Object.fromEntries(
        await Promise.all(
          ips.map(
            async (ip: string): Promise<[string, APIResponse | undefined]> => [
              ip,
              await client.get(ip),
            ],
          ),
        ),
      );
    const ipsToLookup: string[] = ips.filter(
      (ip: string): boolean => !cacheResults[ip],
    );
    const newResults: APIBulkResponse = R.mergeAll(
      await Promise.all(
        R.chunk(ipsToLookup, this.maxBulkSize).map(
          async (chunk: string[]): Promise<APIBulkResponse> =>
            await this._bulk(chunk),
        ),
      ),
    );
    const results: APIBulkResponse = R.merge(cacheResults, newResults);
    return results;
  }

  protected async _bulk(ips: string[]): Promise<APIBulkResponse> {
    const results = (await ky
      .post(this.url, { json: { ips, key: this.key } })
      .json()) as APIBulkResponse;
    delete results.total_elapsed_ms;
    await Promise.all(
      Object.entries(results).map(
        async ([ip, value]: [string, APIResponse]): Promise<void> => {
          await client.set(ip, value);
        },
      ),
    );
    return results;
  }
}
