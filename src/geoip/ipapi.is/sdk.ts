import { Cacheable } from "@type-cacheable/core";
import { fetchUnsafe } from "../../utils";
import type { APIResponse, BulkAPIResponse } from "./schema";

export class IPAPIis {
  public baseUrl: string = "https://api.ipapi.is";
  public key: string;

  constructor(key: string, baseUrl: string = "https://api.ipapi.is") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  @Cacheable({
    cacheKey(args: any[], _context?: any): string {
      const ip = args[0] as string;
      return ip;
    },
  })
  async lookup(ip: string): Promise<APIResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", ip);
    url.searchParams.set("key", this.key);
    const response = await fetchUnsafe(url);
    const data = (await response.json()) as APIResponse;
    return data;
  }

  async bulk(ips: string[]): Promise<BulkAPIResponse> {
    const response = await fetchUnsafe(this.baseUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ips, key: this.key }),
    });
    const data = (await response.json()) as BulkAPIResponse;
    return data;
  }
}
