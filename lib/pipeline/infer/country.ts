import consola from "consola";
import type { Country } from "world-countries";
import countries from "world-countries";

interface ProxyWrapper {
  name: string;
  country: Country;
  info: boolean;
}

export const COUNTRY_UNKNOWN: Country = {
  name: {
    common: "Unknown",
  },
  cca2: "UN",
  flag: "🇺🇳",
} as Country;

export const CCA2_TO_COUNTRY: Record<string, Country> = Object.fromEntries(
  [...countries, COUNTRY_UNKNOWN].map((country: Country): [string, Country] => [
    country.cca2,
    country,
  ]),
);

const PATTERNS: Record<string, RegExp> = { TW: /台湾|台灣/u };
const PROVIDER_INFO_PATTERN: RegExp = /Expire|Traffic|剩余流量|套餐到期/i;

export function inferCountry<T extends ProxyWrapper>(proxies: T[]): T[] {
  return proxies.map((proxy: T): T => {
    const country: Country = proxy.info ? COUNTRY_UNKNOWN : countryFromName(proxy.name);
    if (country.cca2 === COUNTRY_UNKNOWN.cca2) {
      consola.warn(`${proxy.name} ~ ${prettyCountry(country)}`);
    } else {
      consola.success(`${proxy.name} ~ ${prettyCountry(country)}`);
    }
    proxy.country = country;
    return proxy;
  });
}

export function countryFromName(name: string): Country {
  if (PROVIDER_INFO_PATTERN.test(name)) return COUNTRY_UNKNOWN;
  for (const country of countries) {
    if (country.cca2 === "CN") continue;
    for (const pattern of patternsFromCountry(country)) {
      if (pattern?.test(name)) return country;
    }
  }
  return COUNTRY_UNKNOWN;
}

function* patternsFromCountry(country: Country): Generator<RegExp | undefined> {
  const EXCLUDE_PATTERNS = new Set([
    "GB", // gigabyte
  ]);

  function short(pattern?: string): RegExp | undefined {
    if (!pattern) return undefined;
    if (EXCLUDE_PATTERNS.has(pattern)) return undefined;
    return new RegExp(`\\b${pattern}\\b`);
  }

  function long(pattern?: string): RegExp | undefined {
    if (!pattern) return undefined;
    if (EXCLUDE_PATTERNS.has(pattern)) return undefined;
    return new RegExp(pattern, "iu");
  }

  if (country.cca2 in PATTERNS) yield PATTERNS[country.cca2];
  yield long(country.name.common);
  yield short(country.cca2);
  yield long(country.flag);
}

function prettyCountry(country: Country): string {
  return `${country.flag} ${country.name.common} (${country.cca2})`;
}
