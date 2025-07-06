import dns from "node:dns";
import { LRUCacheAdapter } from "@type-cacheable/lru-cache-adapter";
import { LRUCache } from "lru-cache";
import { z } from "zod/v4";
import { getLogger } from "../utils";

const logger = getLogger();

const cache: LRUCache<string, string[]> = new LRUCache({ max: 1024 });
const client: LRUCacheAdapter<string[]> = new LRUCacheAdapter(cache);

export class DNS {
  async resolveIP(server: string): Promise<string[]> {
    if (isIP(server)) return [server];
    const results: string[] = [];
    results.push(...(await this.resolve4(server)));
    results.push(...(await this.resolve6(server)));
    const cnames: string[] = await this.resolveCname(server);
    results.push(
      ...(
        await Promise.all(
          cnames.map(
            async (cname: string): Promise<string[]> =>
              await this.resolveIP(cname),
          ),
        )
      ).flat(),
    );
    return results;
  }

  async resolve4(server: string): Promise<string[]> {
    if (isIP(server)) return [server];
    const cacheKey: string = `A:${server}`;
    const cached: string[] | undefined = await client.get(cacheKey);
    if (cached !== undefined) return cached;
    let results: string[] = [];
    try {
      results = await dns.promises.resolve4(server);
    } catch (err) {
      logger.debug(`${err}`);
    }
    await client.set(cacheKey, results);
    return results;
  }

  async resolve6(server: string): Promise<string[]> {
    if (isIP(server)) return [server];
    const cacheKey: string = `AAAA:${server}`;
    const cached: string[] | undefined = await client.get(cacheKey);
    if (cached !== undefined) return cached;
    let results: string[] = [];
    try {
      results = await dns.promises.resolve6(server);
    } catch (err) {
      logger.debug(`${err}`);
    }
    await client.set(cacheKey, results);
    return results;
  }

  async resolveCname(server: string): Promise<string[]> {
    if (isIP(server)) return [server];
    const cacheKey: string = `CNAME:${server}`;
    const cached: string[] | undefined = await client.get(cacheKey);
    if (cached !== undefined) return cached;
    let results: string[] = [];
    try {
      results = await dns.promises.resolveCname(server);
    } catch (err) {
      logger.debug(`${err}`);
    }
    await client.set(cacheKey, results);
    return results;
  }
}

function isIP(server: string): boolean {
  return (
    z.ipv4().safeParse(server).success || z.ipv6().safeParse(server).success
  );
}
