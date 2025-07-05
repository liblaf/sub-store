import type { Country } from "world-countries";
import countries from "world-countries";
import { DNS } from "../dns";
import { API, type APIOptions } from "./api";
import type { APIBulkResponse, APIResponse } from "./schema";

export class GeoIP {
  api: API;
  dns: DNS = new DNS();
  countries: Record<string, Country> = Object.fromEntries(
    countries.map((country: Country): [string, Country] => [
      country.cca2,
      country,
    ]),
  );

  constructor(options: APIOptions) {
    this.api = new API(options);
  }

  async lookup(server: string): Promise<Country | undefined> {
    const ips: string[] = await this.dns.resolve4(server);
    if (!ips) return undefined;
    const ip: string = ips[0]!;
    const result: APIResponse = await this.api.lookup(ip);
    return this.countries[result.location.country_code];
  }

  async bulk(servers: string[]): Promise<Record<string, Country | undefined>> {
    const ips: Record<string, string | undefined> = Object.fromEntries(
      await Promise.all(
        servers.map(
          async (server: string): Promise<[string, string | undefined]> => {
            const ips: string[] = await this.dns.resolve4(server);
            return [server, ips[0]];
          },
        ),
      ),
    );
    const results: APIBulkResponse = await this.api.bulk(
      Object.values(ips).filter(
        (ip: string | undefined): ip is string => ip !== undefined,
      ),
    );
    const countries: Record<string, Country | undefined> = {};
    for (const server of servers) {
      const ip: string | undefined = ips[server];
      if (!ip) {
        countries[server] = undefined;
        continue;
      }
      const cca2: string | undefined = results[ip]?.location?.country_code;
      if (!cca2) {
        countries[server] = undefined;
        continue;
      }
      countries[server] = this.countries[cca2];
    }
    return countries;
  }
}
