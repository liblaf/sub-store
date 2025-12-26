import type { Profiles } from "./_schema";
import { PROFILES_SCHEMA } from "./_schema";

export async function getProfiles(kv: KVNamespace): Promise<Profiles> {
  const data: unknown = await kv.get("profiles", { type: "json" });
  if (!data) return {};
  return PROFILES_SCHEMA.parse(data);
}

export async function putProfiles(
  kv: KVNamespace,
  profiles: Profiles,
): Promise<void> {
  await kv.put("profiles", JSON.stringify(profiles));
}
