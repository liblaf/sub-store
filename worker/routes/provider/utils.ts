import type { Context } from "hono";
import { env } from "hono/adapter";
import z from "zod";
import type { Provider } from "./schema";
import { PROVIDER_SCHEMA } from "./schema";

export async function getProviders(
  c: Context<{ Bindings: CloudflareBindings }>,
): Promise<Record<string, Provider>> {
  const schema = z.record(z.string(), PROVIDER_SCHEMA);
  const providers = schema.parse(await env(c).SUB.get("providers", "json"));
  return providers;
}

export async function fetchMihomo(
  c: Context<{ Bindings: CloudflareBindings }>,
  provider: Provider,
) {
  if (!provider.mihomo) return null;
}

export async function fetchMihomoInfo() {}

export async function fetchXray() {}

export async function fetchJmsInfo() {}
