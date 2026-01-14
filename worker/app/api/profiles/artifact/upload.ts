import type { Profile } from "@shared/schema/profile";
import { ProfileStore } from "@worker/kv/profile";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException, OpenAPIRoute } from "chanfana";
import z from "zod";
import { PARAMS_SCHEMA } from "./schema";

export class UploadProfileArtifact extends OpenAPIRoute {
  static method: RequestMethod = "post";
  static path: string = "/api/profiles/:id/:filename";

  override schema = {
    tags: ["Profiles"],
    summary: "Upload Profile Artifact",
    request: {
      params: PARAMS_SCHEMA,
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
    const { id, filename } = params;
    const store = new ProfileStore(this.kv);
    const profile: Profile | null = await store.read(id);
    if (!profile) throw new NotFoundException();
    const content: string = await c.req.text();
    await store.artifacts.create(id, filename, content);
    return c.json({ success: true });
  }
}
