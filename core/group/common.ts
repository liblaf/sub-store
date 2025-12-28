import type { OutboundWrapper } from "@core/formats/shared/outbound";
import type { GroupMeta } from "./abc";
import { FilterGrouper } from "./abc";

export function good<T = unknown>(outbound: OutboundWrapper<T>): boolean {
  // connection quality of Hysteria2 is poor
  return !outbound.emby && !outbound.info && outbound.type !== "hysteria2";
}

export class Info extends FilterGrouper {
  override meta: GroupMeta = {
    name: "Info",
    type: "url-test",
    emoji: "ℹ️",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Airport.png",
  };

  override filter(outbound: OutboundWrapper): boolean {
    return outbound.info;
  }
}

export class Auto extends FilterGrouper {
  override meta: GroupMeta = {
    name: "Auto",
    type: "url-test",
    emoji: "🚀",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Auto.png",
  };

  override filter(outbound: OutboundWrapper): boolean {
    return good(outbound) && outbound.multiplier <= 2.0;
  }
}

export class Binance extends FilterGrouper {
  static BINANCE_EXCLUDE_REGIONS: Set<string> = new Set([
    "CA",
    "CN",
    "CU",
    "HK",
    "IR",
    "KP",
    "MO",
    "NL",
    "TW",
    "US",
  ]);

  override meta: GroupMeta = {
    name: "Binance",
    type: "url-test",
    emoji: "🪙",
    // TODO: add icon
    url: "https://api.binance.com/api/v3/ping",
  };

  override filter(outbound: OutboundWrapper): boolean {
    return (
      good(outbound) &&
      !!outbound.country &&
      !Binance.BINANCE_EXCLUDE_REGIONS.has(outbound.country.cca2)
    );
  }
}

export class Ai extends FilterGrouper {
  static AI_EXCLUDE_REGIONS: Set<string> = new Set(["HK", "MO"]);

  override meta: GroupMeta = {
    name: "AI",
    type: "url-test",
    emoji: "🤖",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/AI.png",
  };

  override filter(outbound: OutboundWrapper): boolean {
    return (
      good(outbound) &&
      !!outbound.country &&
      !Ai.AI_EXCLUDE_REGIONS.has(outbound.country.cca2)
    );
  }
}

export class Download extends FilterGrouper {
  override meta: GroupMeta = {
    name: "Download",
    type: "url-test",
    emoji: "📥",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Download.png",
  };

  override filter(outbound: OutboundWrapper): boolean {
    return good(outbound) && outbound.multiplier <= 1.0;
  }
}

export class Stream extends FilterGrouper {
  override meta: GroupMeta = {
    name: "Stream",
    type: "url-test",
    emoji: "📺",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png",
  };

  override filter(outbound: OutboundWrapper): boolean {
    return good(outbound) && outbound.multiplier < 2.0;
  }
}
