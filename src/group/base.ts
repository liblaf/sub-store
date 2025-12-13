import type { Outbound } from "../core";

export type Group = {
  name: string;
  type: "select" | "url-test";
  emoji?: string;
  icon?: string;
  url?: string;
  filter(outbound: Outbound): boolean;
};
