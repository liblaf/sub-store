import countries from "world-countries";
import { COUNTRY_UNKNOWN } from "../outbound";
import type { Group } from "./abc";
import { AI, AUTO, DOWNLOAD, INFO, PROXY, STREAM } from "./common";
import { newCountryGroup } from "./country";
import { CITRUSLAB_EMBY } from "./extra";

export function newGroups(): Group[] {
  return [
    PROXY,
    INFO,
    AUTO,
    AI,
    DOWNLOAD,
    STREAM,
    CITRUSLAB_EMBY,
    ...countries.map(newCountryGroup),
    newCountryGroup(COUNTRY_UNKNOWN),
  ];
}
