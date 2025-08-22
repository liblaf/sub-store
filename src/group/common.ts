import type { Outbound } from "../outbound";
import type { Group } from "./abc";

export function good(outbound: Outbound): boolean {
  // connection quality of Hysteria2 is poor
  return !outbound.emby && !outbound.info && outbound.type !== "hysteria2";
}

export const PROXY: Group = {
  name: "PROXY",
  type: "select",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Proxy.png",
  filter(_outbound: Outbound): boolean {
    return false;
  },
};

export const INFO: Group = {
  name: "INFO",
  type: "url-test",
  emoji: "ℹ️",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Airport.png",
  filter(outbound: Outbound): boolean {
    return outbound.info;
  },
};

export const AUTO: Group = {
  name: "Auto",
  type: "url-test",
  emoji: "🚀",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Auto.png",
  filter(outbound: Outbound): boolean {
    return good(outbound) && outbound.multiplier <= 2.0;
  },
};

const AI_EXCLUDE_REGIONS = new Set(["HK", "MO"]);
export const AI: Group = {
  name: "AI",
  type: "url-test",
  emoji: "🤖",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/AI.png",
  filter(outbound: Outbound): boolean {
    return (
      good(outbound) &&
      !!outbound.country &&
      !AI_EXCLUDE_REGIONS.has(outbound.country.cca2)
    );
  },
};

export const DOWNLOAD: Group = {
  name: "Download",
  type: "url-test",
  emoji: "📥",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Download.png",
  filter(outbound: Outbound): boolean {
    return good(outbound) && outbound.multiplier <= 1.0;
  },
};

export const STREAM: Group = {
  name: "Stream",
  type: "url-test",
  emoji: "📺",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png",
  filter(outbound: Outbound): boolean {
    return good(outbound) && outbound.multiplier < 2.0;
  },
};
