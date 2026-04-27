import { OpenAPIRoute } from "chanfana";
import type { OpenAPIRouteSchema } from "chanfana";
import type { Context } from "hono";
import z from "zod";

export class RouteApiUpload extends OpenAPIRoute {
  override schema = {
    request: {
      params: z.object({
        filename: z.string(),
      }),
      query: z.object({
        id: z.uuid(),
      }),
      headers: z.object({
        "Subscription-Userinfo": z.string().optional(),
      }),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context<{ Bindings: Env }>): Promise<Response> {
    const { params, query, headers } = await this.getValidatedData<typeof this.schema>();
    const key: string = `${query.id}/${params.filename}`;
    const body: string = await c.req.text();
    await c.env.KV.put(key, body, {
      metadata: {
        userinfo: headers["Subscription-Userinfo"],
      },
    });
    return c.body(null, 204);
  }
}
