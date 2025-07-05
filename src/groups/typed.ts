import type { Outbound } from "../outbound";

export type Group = {
  name: string;
  type: "select" | "url-test";
  emoji?: string;
  icon?: string;
  url?: string;
  filter: (outbound: Outbound) => boolean;
};
