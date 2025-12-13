import twemoji from "@twemoji/api";
import type { Country } from "world-countries";
import type { Outbound } from "../core";
import type { Group } from "./base";
import { good } from "./common";

export function newCountryGroup(
  country: Country,
  options?: { type?: "select" | "url-test" },
): Group {
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
    type: options?.type ?? "url-test",
    emoji: flag,
    icon,
    filter(outbound: Outbound): boolean {
      return good(outbound) && outbound.country.cca2 === cca2;
    },
  };
}
