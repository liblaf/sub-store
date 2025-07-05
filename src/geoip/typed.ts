import type { Country } from "world-countries";

export interface GeoIP {
  lookup(server: string): Promise<Country | undefined>;
  bulk(servers: string[]): Promise<Record<string, Country | undefined>>;
}
