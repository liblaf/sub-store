import twemoji from "@twemoji/api";
import type { Country } from "world-countries";
import { COUNTRY_UNKNOWN, type Outbound } from "../outbound";
import type { Group } from "./abc";
import { good } from "./common";

export function newCountryGroup(country: Country): Group {
  const { cca2, flag } = country;
  const codePoint: string = twemoji.convert.toCodePoint(flag);
  const icon: string = "".concat(
    twemoji.base,
    twemoji.size,
    "/",
    codePoint,
    twemoji.ext,
  );
  return {
    name: country.name.common,
    type: cca2 === COUNTRY_UNKNOWN.cca2 ? "select" : "url-test",
    emoji: flag,
    icon,
    filter(outbound: Outbound): boolean {
      return good(outbound) && outbound.country.cca2 === cca2;
    },
  };
}
