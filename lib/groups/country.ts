import type { Country } from "world-countries";
import countries from "world-countries";

import type { ProxyWrapper } from "@/lib/core/proxy";
import { COUNTRY_UNKNOWN } from "@/lib/pipeline/infer/country";

import type { Group } from "./types";

const CCA2_TO_COUNTRY: Record<string, Country> = Object.fromEntries(
  countries.map((country: Country): [string, Country] => [country.cca2, country]),
);

export function groupByCountry<T>(proxies: ProxyWrapper<T>[]): Group<T>[] {
  const cca2ToGroup: Record<string, Group<T>> = {};
  for (const proxy of proxies) {
    const group: Group<T> = (cca2ToGroup[proxy.country.cca2] ??= emptyGroupFromCountry(
      proxy.country,
    ));
    group.proxies.push(proxy);
  }
  return Object.values(cca2ToGroup).sort(
    (a: Group<T>, b: Group<T>): number => b.proxies.length - a.proxies.length,
  );
}

export function groupFromCca2<T>(proxies: ProxyWrapper<T>[], cca2: string): Group<T> {
  const country: Country = CCA2_TO_COUNTRY[cca2] ?? COUNTRY_UNKNOWN;
  const group: Group<T> = emptyGroupFromCountry(country);
  group.proxies = proxies.filter((proxy: ProxyWrapper<T>): boolean => proxy.country.cca2 === cca2);
  return group;
}

function emptyGroupFromCountry<T>(country: Country): Group<T> {
  return {
    name: country.name.common,
    type: country.cca2 === COUNTRY_UNKNOWN.cca2 ? "select" : "url-test",
    proxies: [],
    url: "https://cp.cloudflare.com",
    "expected-status": 204,
    icon: "TODO",
  };
}
