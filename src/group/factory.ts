import countries from "world-countries";
import { COUNTRY_UNKNOWN } from "../utils";
import type { Group } from "./abc";
import { AI, AUTO, DOWNLOAD, INFO, STREAM } from "./common";
import { newCountryGroup } from "./country";
import { CITRUSLAB_EMBY } from "./extra";

export function newGroups(): Group[] {
  return [
    AUTO,
    INFO,
    AI,
    DOWNLOAD,
    STREAM,
    CITRUSLAB_EMBY,
    ...countries.map(newCountryGroup),
    newCountryGroup(COUNTRY_UNKNOWN),
  ];
}
