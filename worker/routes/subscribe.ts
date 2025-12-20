import type { OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { env } from "hono/adapter";
import z from "zod";

export class RouteSubscribe extends OpenAPIRoute {
  override schema = {
    request: {
      params: z.object({
        filename: z
          .string()
          .openapi({ examples: ["mihomo.yaml", "stash.yaml"] }),
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
          "text/plain": {
            schema: {
              type: "string",
            },
          },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(
    c: Context<{ Bindings: CloudflareBindings }>,
  ): Promise<Response> {
    const data = await this.getValidatedData<typeof this.schema>();
    const key = `artifact/${data.query.id}/${data.params.filename}`;
    const artifact = await env(c).SUB.get(key);
    if (artifact === null) return c.notFound();
    return c.text(artifact);
  }
}
