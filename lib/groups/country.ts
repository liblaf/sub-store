import twemoji from "@twemoji/api";
import type { Country } from "world-countries";

import type { ProxyWrapper } from "@/lib/core/proxy";
import { COUNTRY_UNKNOWN, CCA2_TO_COUNTRY } from "@/lib/pipeline/infer/country";

import { icon } from "../utils";
import type { Group } from "./types";

export function groupByCountry<T>(proxies: ProxyWrapper<T>[]): Group<T>[] {
  const cca2ToGroup: Record<string, Group<T>> = {};
  for (const proxy of proxies) {
    if (proxy.info) continue;
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
  group.proxies = proxies.filter(
    (proxy: ProxyWrapper<T>): boolean => !proxy.info && proxy.country.cca2 === cca2,
  );
  return group;
}

function emptyGroupFromCountry<T>(country: Country): Group<T> {
  return {
    name: country.name.common,
    type: country.cca2 === COUNTRY_UNKNOWN.cca2 ? "select" : "url-test",
    proxies: [],
    url: "https://cp.cloudflare.com",
    "expected-status": 204,
    icon: iconFromCountry(country),
  };
}

const CCA2_TO_ICON: Record<string, string> = {
  AR: "Argentina",
  AU: "Australia",
  BR: "Brazil",
  CA: "Canada",
  CN: "China",
  DE: "Germany",
  EG: "Egypt",
  FI: "Finland",
  FR: "France",
  HK: "Hong_Kong",
  IN: "India",
  JP: "Japan",
  KR: "Korea",
  MO: "Macao",
  MY: "Malaysia",
  PH: "Philippines",
  RU: "Russia",
  SG: "Singapore",
  TH: "Thailand",
  TR: "Turkey",
  TW: "Taiwan",
  UA: "Ukraine",
  UK: "United_Kingdom",
  UN: "United_Nations",
  US: "United_States",
};

function iconFromCountry(country: Country): string {
  if (country.cca2 in CCA2_TO_ICON) {
    return icon(CCA2_TO_ICON[country.cca2]!);
  }
  return [
    twemoji.base,
    twemoji.size,
    "/",
    twemoji.convert.toCodePoint(country.flag),
    twemoji.ext,
  ].join("");
}
