import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import z from "zod/v3";

export class ProviderUserinfo extends OpenAPIRoute {
  static method: RequestMethod = "get";
  static path: string = "/api/provider/:id/userinfo.json";

  override schema = {
    tags: ["Providers"],
    summary: "Get Provider Userinfo",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const { id } = params;
    return c.json({});
  }
}
