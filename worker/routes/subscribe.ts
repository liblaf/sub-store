import type { Context } from "hono";

import { PROFILE_ID_SCHEMA } from "@/lib/core/profile";

type Metadata = {
  headers?: Record<string, string>;
};

const ARTIFACT_FILENAMES = new Set(["mihomo.yaml", "stash.yaml"]);
const SUBSCRIPTION_ORIGIN = "https://subs.liblaf.me";

export async function serveSubscription(c: Context<{ Bindings: Env }>): Promise<Response> {
  const { id, filename } = c.req.param();
  if (
    !id ||
    !filename ||
    !PROFILE_ID_SCHEMA.safeParse(id).success ||
    !ARTIFACT_FILENAMES.has(filename)
  ) {
    return c.notFound();
  }

  const result: KVNamespaceGetWithMetadataResult<string, Metadata> = await c.env.KV.getWithMetadata(
    `artifacts/${id}/${filename}`,
  );
  if (result.value === null) return c.notFound();

  const headers = new Headers(result.metadata?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/yaml");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Robots-Tag", "noindex");
  const marker = `#SUBSCRIBED ${SUBSCRIPTION_ORIGIN}/subs/${id}/${filename}`;
  return new Response(`${marker}\n${result.value}`, { headers });
}
