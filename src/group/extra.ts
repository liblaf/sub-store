import type { Outbound } from "../outbound";
import type { Group } from "./abc";

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
