import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException, OpenAPIRoute } from "chanfana";
import { env } from "hono/adapter";
import z from "zod/v3";
import type { Context } from "../../../../_utils";
import type { RequestMethod } from "../../../_utils";
import { getProfiles } from "../_kv";
import type { Profiles } from "../_schema";
import { deleteProfileArtifact } from "./_kv";
import { PARAMS_SCHEMA } from "./_schema";

export class DeleteProfileArtifact extends OpenAPIRoute {
  static method: RequestMethod = "delete";
  static path: string = "/api/profiles/:id/:filename";

  override schema = {
    tags: ["Profiles"],
    summary: "Delete Profile Artifact",
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
    const kv: KVNamespace = env(c).SUB;
    const profiles: Profiles = await getProfiles(kv);
    if (!profiles[params.id]) throw new NotFoundException();
    await deleteProfileArtifact(kv, params.id, params.filename);
    return c.json({ success: true });
  }
}
