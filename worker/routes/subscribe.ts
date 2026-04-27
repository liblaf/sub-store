import { NotFoundException, OpenAPIRoute } from "chanfana";
import type { OpenAPIRouteSchema } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export class RouteSubscribe extends OpenAPIRoute {
  override schema = {
    request: {
      params: z.object({
        filename: z.string(),
      }),
      query: z.object({
        id: z.uuid(),
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/yaml": {
            schema: z.any(),
          },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context<{ Bindings: Env }>): Promise<Response> {
    const { params, query } = await this.getValidatedData<typeof this.schema>();
    const sub: string | null = await c.env.KV.get(query.id);
    if (!sub) throw new NotFoundException();
    if (params.filename.endsWith(".yaml")) c.header("Content-Type", "application/yaml");
    return c.text(sub);
  }
}
