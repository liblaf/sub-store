import fs from "node:fs/promises";

import YAML from "yaml";

import { PROFILE_SCHEMA } from "./profile";
import type { Profile } from "./profile";

/** Read one native profile, resolving YAML merge keys before validation. */
export async function loadProfile(file: string): Promise<Profile> {
  return PROFILE_SCHEMA.parse(YAML.parse(await fs.readFile(file, "utf-8"), { merge: true }));
}
