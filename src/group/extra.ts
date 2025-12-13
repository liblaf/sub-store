import type { Outbound } from "../core";
import type { Group } from "./base";

export const CITRUSLAB_EMBY: Group = {
  name: "CitrusLab Emby",
  type: "url-test",
  emoji: "🍟",
  icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Emby.png",
  url: "https://shenmi.link",
  filter(outbound: Outbound): boolean {
    return outbound.provider.name === "CitrusLab" && outbound.emby;
  },
};
