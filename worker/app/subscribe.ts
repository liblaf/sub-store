import { PROFILE_ID_SCHEMA } from "@shared/schema/profile";
import { ProfileStore } from "@worker/kv/profile";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod/v3";

export class Subscribe extends OpenAPIRoute {
  static method: RequestMethod = "get";
  static path: string = "/subscribe/:filename";

  override schema = {
    tags: ["Subscription"],
    summary: "Download subscription",
    request: {
      params: z.object({
        filename: z.string(),
      }),
      query: z.object({
        id: PROFILE_ID_SCHEMA,
      }),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params, query } = await this.getValidatedData<typeof this.schema>();
    const { filename } = params;
    const { id } = query;
    const store = new ProfileStore(this.kv);
    const { content, metadata } = await store.artifacts.text(id, filename);
    if (!content || !metadata) throw new NotFoundException();
    c.header("X-Last-Modified", new Date(metadata.mtime).toUTCString());
    if (filename.endsWith(".json"))
      c.header("Content-Type", "application/json");
    if (filename.endsWith(".yaml") || filename.endsWith(".yml"))
      c.header("Content-Type", "application/yaml");
    return c.text(content);
  }
}
