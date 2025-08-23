import type { Country } from "world-countries";
import countries from "world-countries";

export const COUNTRY_UNKNOWN = {
  name: { common: "Unknown" },
  cca2: "UN",
  flag: "🇺🇳",
} as Country;

export function lookupCountry(cca2: string): Country | undefined {
  return countries.find((country: Country): boolean => country.cca2 === cca2);
}
