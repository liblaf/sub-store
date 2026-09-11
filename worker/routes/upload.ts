import type { Context } from "hono";

import { PROFILE_ID_SCHEMA } from "@/lib/core/profile";
import { ARTIFACT_UPLOAD_SCHEMA } from "@/lib/publish/schema";

export async function uploadArtifacts(c: Context<{ Bindings: Env }>): Promise<Response> {
  const { id } = c.req.param();
  if (!id || !PROFILE_ID_SCHEMA.safeParse(id).success) return c.notFound();

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.text("Invalid JSON", 400);
  }

  const parsed = ARTIFACT_UPLOAD_SCHEMA.safeParse(payload);
  if (!parsed.success) return c.text("Invalid artifact upload", 400);

  try {
    for (const format of ["mihomo", "stash"] as const) {
      const artifact = parsed.data[format];
      await c.env.KV.put(`artifacts/${id}/${format}.yaml`, artifact.body, {
        metadata: artifact.metadata,
      });
    }
  } catch {
    return c.text("Internal Server Error", 500);
  }

  return c.body(null, 204);
}
