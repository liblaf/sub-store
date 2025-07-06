import YAML from "yaml";
import type { Mihomo } from "./schema";

export function parseMihomo(text: string): Mihomo {
  return YAML.parse(text, { merge: true }) as Mihomo;
}
