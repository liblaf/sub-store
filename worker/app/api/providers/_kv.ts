import type { Providers } from "./_schema";
import { PROVIDERS_SCHEMA } from "./_schema";

export async function getProviders(kv: KVNamespace): Promise<Providers> {
  const data: unknown = await kv.get("providers", { type: "json" });
  if (!data) return {};
  return PROVIDERS_SCHEMA.parse(data);
}

export async function putProviders(
  kv: KVNamespace,
  providers: Providers,
): Promise<void> {
  await kv.put("providers", JSON.stringify(providers));
}
