import { NotFoundException, OpenAPIRoute } from "chanfana";
import type { OpenAPIRouteSchema } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

type Metadata = {
  headers: Record<string, string>;
};

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
    const result: KVNamespaceGetWithMetadataResult<string, Metadata> =
      await c.env.KV.getWithMetadata(`artifacts/${query.id}/${params.filename}`);
    if (!result.value) throw new NotFoundException();
    if (result.metadata?.headers) {
      for (const [key, value] of Object.entries(result.metadata.headers)) {
        c.header(key, value);
      }
    }
    if (params.filename.endsWith(".yaml")) c.header("Content-Type", "application/yaml");
    return c.text(result.value);
  }
}
