import { env } from "hono/adapter";
import type { Context } from "../../../types";
import type { Profiles } from "./schema";
import { PROFILES_SCHEMA } from "./schema";

const PROFILES_KEY = "profiles";

export async function getProfiles(c: Context): Promise<Profiles> {
  const data: unknown = await env(c).SUB.get(PROFILES_KEY, { type: "json" });
  if (!data) return {};
  return PROFILES_SCHEMA.parse(data);
}

export async function putProfiles(
  c: Context,
  profiles: Profiles,
): Promise<void> {
  await env(c).SUB.put(PROFILES_KEY, JSON.stringify(profiles));
}
