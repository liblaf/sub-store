import YAML from "yaml";
import { MIHOMO_SCHEMA, type Mihomo } from "./schema";

export function parseMihomo(text: string): Mihomo {
  return MIHOMO_SCHEMA.parse(YAML.parse(text));
}
