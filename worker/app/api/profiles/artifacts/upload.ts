import type { Context } from "@worker/_utils";
import type { RequestMethod } from "@worker/app/_abc";
import { OpenAPIRoute } from "@worker/app/_abc";
import type { Profiles } from "@worker/kv";
import { ProfileStore } from "@worker/kv";
import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException } from "chanfana";
import z from "zod/v3";
import { PARAMS_SCHEMA } from "./_schema";

export class UploadProfileArtifact extends OpenAPIRoute {
  static override method: RequestMethod = "post";
  static override path: string = "/api/profiles/:id/:filename";

  override schema = {
    tags: ["Profiles"],
    summary: "Upload Profile Artifact",
    request: {
      params: PARAMS_SCHEMA,
      body: {
        content: {
          "application/json": { schema: z.any() },
          "application/yaml": { schema: z.any() },
          "text/plain": { schema: z.string() },
        },
      },
    },
    responses: {
      200: {
        description: "OK",
        ...contentJson(
          z.object({
            success: z.boolean(),
          }),
        ),
      },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const store = new ProfileStore(this.kv);
    const profiles: Profiles = await store.list();
    if (!profiles[params.id]) throw new NotFoundException();
    const content: string = await c.req.text();
    await store.createArtifact(params.id, params.filename, content);
    return c.json({ success: true });
  }
}
