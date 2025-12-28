import type { LookupAddress } from "node:dns";
import dns from "node:dns/promises";
import DataLoader from "dataloader";
import { z } from "zod";
import { COUNTRY_UNKNOWN } from "../constants";
import type { GeoIpApiResponse } from "./ipapi.is";
import { IpapiIs } from "./ipapi.is";

export class GeoIP {
  private api: IpapiIs;
  private loader: DataLoader<string, GeoIpApiResponse>;

  public constructor() {
    this.api = new IpapiIs();
    this.loader = new DataLoader(
      async (servers: readonly string[]): Promise<GeoIpApiResponse[]> =>
        await this.batchLoadFn(servers),
    );
  }

  public async lookup(server: string): Promise<GeoIpApiResponse> {
    return await this.loader.load(server);
  }

  protected async batchLoadFn(
    servers: readonly string[],
  ): Promise<GeoIpApiResponse[]> {
    return await Promise.all(
      servers.map(
        async (server: string): Promise<GeoIpApiResponse> =>
          await this.loadFn(server),
      ),
    );
  }

  protected async loadFn(server: string): Promise<GeoIpApiResponse> {
    let ips: string[] = [];
    if (isIpAddr(server)) {
      ips = [server];
    } else {
      const addresses: LookupAddress[] = await dns.lookup(server, {
        all: true,
      });
      ips = addresses.map((addr: LookupAddress): string => addr.address);
    }
    const responses: GeoIpApiResponse[] = await Promise.all(
      ips.map(
        async (ip: string): Promise<GeoIpApiResponse> =>
          await this.api.lookup(ip),
      ),
    );
    for (const response of responses) {
      if (!response.location?.country_code) continue;
      return response;
    }
    return {
      ip: ips[0] ?? "",
      location: { country_code: COUNTRY_UNKNOWN.cca2 },
    };
  }
}

function isIpAddr(data: string): boolean {
  return z.string().ip().safeParse(data).success;
}
