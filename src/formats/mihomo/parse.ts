import YAML from "yaml";
import { MIHOMO_SCHEMA, type Mihomo } from "./schema";

export function mihomoParse(text: string): Mihomo {
  const data: any = YAML.parse(text, { merge: true });
  return MIHOMO_SCHEMA.parse(data);
}
