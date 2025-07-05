import dns from "node:dns";
import { LRUCacheAdapter } from "@type-cacheable/lru-cache-adapter";
import { LRUCache } from "lru-cache";
import { z } from "zod/v4";

const cache: LRUCache<string, string[]> = new LRUCache({ max: 1024 });
const client: LRUCacheAdapter<string[]> = new LRUCacheAdapter(cache);

export class DNS {
  async resolve4(server: string): Promise<string[]> {
    if (z.ipv4().safeParse(server).success) return [server];
    if (z.ipv6().safeParse(server).success) return [server];
    const cached: string[] | undefined = await client.get(server);
    if (cached !== undefined) return cached;
    const results: string[] = await dns.promises.resolve4(server);
    await client.set(server, results);
    return results;
  }
}
