import type { Country } from "world-countries";
import countries from "world-countries";
import type { Outbound } from "../outbound";
import type { Group } from "./typed";

export function makeCountryGroup(country: Country | undefined): Group {
  const cca2: string = country?.cca2.toLowerCase() ?? "un";
  return {
    name: country ? country.name.common : "Unknown",
    type: country ? "url-test" : "select",
    emoji: country ? country.flag : "🇺🇳",
    icon: `https://flagcdn.com/256x192/${cca2}.png`,
    filter(outbound: Outbound): boolean {
      if (!country) return outbound.country === undefined;
      if (!outbound.country) return false;
      return outbound.country === country.cca2;
    },
  };
}

export const PROXY: Group = {
  name: "PROXY",
  type: "select",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Proxy.png",
  filter(_outbound: Outbound): boolean {
    return false;
  },
};

export const SELECT: Group = {
  name: "Select",
  type: "select",
  emoji: "",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Static.png",
  filter(_outbound: Outbound): boolean {
    return true;
  },
};

export const AUTO: Group = {
  name: "Auto",
  type: "url-test",
  emoji: "🚀",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Auto.png",
  filter(outbound: Outbound): boolean {
    return !outbound.emby;
  },
};

const AI_EXCLUDE_REGIONS = new Set(["CN", "HK", "MO"]);
export const AI: Group = {
  name: "AI",
  type: "url-test",
  emoji: "🤖",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/AI.png",
  filter(outbound: Outbound): boolean {
    return (
      !outbound.emby &&
      !!outbound.country &&
      !AI_EXCLUDE_REGIONS.has(outbound.country)
    );
  },
};

export const DOWNLOAD: Group = {
  name: "Download",
  type: "url-test",
  emoji: "📥",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Download.png",
  filter(outbound: Outbound): boolean {
    return !outbound.emby && outbound.multiplier <= 1.0;
  },
};

export const STREAM: Group = {
  name: "Stream",
  type: "url-test",
  emoji: "📺",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png",
  filter(outbound: Outbound): boolean {
    return !outbound.emby && outbound.multiplier < 2.0;
  },
};

// region Custom

export const CITRUSLAB_EMBY: Group = {
  name: "CitrusLab Emby",
  type: "url-test",
  emoji: "🍟",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Emby.png",
  url: "https://cp.cloudflare.com", // TODO: replace with actual URL
  filter(outbound: Outbound): boolean {
    return outbound.emby && outbound.provider === "CitrusLab";
  },
};

// endregion Custom

export function defaultGroups(): Group[] {
  return [
    PROXY,
    SELECT,
    AUTO,
    AI,
    DOWNLOAD,
    STREAM,
    CITRUSLAB_EMBY,
    ...countries.map(makeCountryGroup),
  ];
}
