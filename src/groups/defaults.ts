import type { Outbound } from "../outbound";
import type { Group } from "./typed";

export const AUTO: Group = {
  name: "Auto",
  type: "url-test",
  filter(_outbound: Outbound): boolean {
    return true;
  },
};

export function defaultGroups(): Group[] {
  return [AUTO];
}
