import type { LookupAddress } from "node:dns";
import dns from "node:dns/promises";
import DataLoader from "dataloader";
import z from "zod";
import { type ApiResponse, IpapiIs } from "./ipapi.is";

export class GeoIP {
  private api: IpapiIs;
  private loader: DataLoader<string, ApiResponse>;

  public constructor() {
    this.api = new IpapiIs();
    this.loader = new DataLoader(
      async (servers: readonly string[]): Promise<ApiResponse[]> =>
        await this.batchLoadFn(servers),
    );
  }

  public async lookup(server: string): Promise<ApiResponse> {
    return await this.loader.load(server);
  }

  protected async batchLoadFn(
    servers: readonly string[],
  ): Promise<ApiResponse[]> {
    return await Promise.all(
      servers.map(
        async (server: string): Promise<ApiResponse> =>
          await this.loadFn(server),
      ),
    );
  }

  protected async loadFn(server: string): Promise<ApiResponse> {
    let ips: string[] = [];
    if (isIpAddr(server)) {
      ips = [server];
    } else {
      const addresses: LookupAddress[] = await dns.lookup(server, {
        all: true,
      });
      ips = addresses.map((addr: LookupAddress): string => addr.address);
    }
    const responses: ApiResponse[] = await Promise.all(
      ips.map(
        async (ip: string): Promise<ApiResponse> => await this.api.lookup(ip),
      ),
    );
    for (const response of responses) {
      if (!response.location?.country_code) continue;
      return response;
    }
    return { ip: ips[0] || "", location: { country_code: "UN" } };
  }
}

function isIpAddr(data: string): boolean {
  return z.ipv4().safeParse(data).success || z.ipv6().safeParse(data).success;
}
