import type { Country } from "world-countries";
import countries from "world-countries";

export function lookupCountry(cca2: string): Country | undefined {
  return countries.find((c: Country): boolean => c.cca2 === cca2);
}
