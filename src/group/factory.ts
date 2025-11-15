import countries from "world-countries";
import { COUNTRY_UNKNOWN } from "../utils";
import type { Group } from "./abc";
import { AI, AUTO, BINANCE, DOWNLOAD, INFO, STREAM } from "./common";
import { newCountryGroup } from "./country";
import { CITRUSLAB_EMBY } from "./extra";

export function newGroups(): Group[] {
  return [
    AUTO,
    INFO,
    AI,
    BINANCE,
    CITRUSLAB_EMBY,
    DOWNLOAD,
    STREAM,
    ...countries.map(newCountryGroup),
    newCountryGroup(COUNTRY_UNKNOWN),
  ];
}
