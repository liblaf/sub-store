import yaml from "js-yaml";
import type { MihomoConfig } from "./schema";

export function parseMihomoConfig(content: string): MihomoConfig {
  return yaml.load(content) as MihomoConfig;
}
