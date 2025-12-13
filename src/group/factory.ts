import countries, { type Country } from "world-countries";
import { COUNTRY_UNKNOWN } from "../utils";
import type { Group } from "./base";
import { AI, AUTO, BINANCE, INFO, STREAM } from "./common";
import { newCountryGroup } from "./country";

export function defaultGroups(): Group[] {
  return [
    AUTO,
    INFO,
    AI,
    BINANCE,
    // CITRUSLAB_EMBY,
    // DOWNLOAD,
    STREAM,
    ...countries.map((c: Country): Group => newCountryGroup(c)),
    newCountryGroup(COUNTRY_UNKNOWN),
  ];
}
