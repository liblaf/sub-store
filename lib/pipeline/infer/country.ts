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
} as Country;

export const CCA2_TO_COUNTRY: Record<string, Country> = Object.fromEntries(
  [...countries, COUNTRY_UNKNOWN].map((country: Country): [string, Country] => [
    country.cca2,
    country,
  ]),
);

const PATTERNS: Record<string, RegExp> = {
  JP: /Japan/i,
  NL: /Netherlands/i,
  US: /Los Angeles/i,
};

export function inferCountry<T extends ProxyWrapper>(proxies: T[]): T[] {
  const cca2ToCountry: Record<string, Country> = Object.fromEntries(
    countries.map((country: Country): [string, Country] => [country.cca2, country]),
  );
  return proxies.map((proxy: T): T => {
    if (proxy.info) {
      proxy.country = COUNTRY_UNKNOWN;
      return proxy;
    }
    for (const [cca2, pattern] of Object.entries(PATTERNS)) {
      if (pattern.test(proxy.name)) {
        consola.success(`${proxy.name} ~ ${pattern}`);
        proxy.country = cca2ToCountry[cca2]!;
        return proxy;
      }
    }
    proxy.country = COUNTRY_UNKNOWN;
    return proxy;
  });
}
