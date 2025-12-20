import { OpenAPIRoute, type OpenAPIRouteSchema } from "chanfana";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import z from "zod";
import { getProviders } from "./utils";

export class GetProviderMihomo extends OpenAPIRoute {
  override schema = {
    request: {
      params: z.object({ name: z.string() }),
    },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/yaml": { schema: z.string() },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(
    c: Context<{ Bindings: CloudflareBindings }>,
  ): Promise<Response> {
    const data = await this.getValidatedData<typeof this.schema>();
    const name = data.params.name;
    const providers = await getProviders(c);
    const provider = providers[name];
    if (!provider) return c.notFound();
    if (provider.mihomo) {
      let content: string | null = null;
      try {
        const response = await fetch(provider.mihomo, {
          headers: { "User-Agent": "clash.meta" },
          redirect: "follow",
        });
        if (!response.ok)
          throw new HTTPException(response.status as ContentfulStatusCode, {
            res: response,
            message: `Failed to fetch mihomo config from ${provider.mihomo}`,
          });
        content = await response.text();
      } catch (err) {
        console.error(err);
        content = await env(c).SUB.get(`provider:${name}:mihomo.yaml`, "text");
        if (content === null) throw err;
      }
      return c.text(content, 200, { "Content-Type": "application/yaml" });
    }
    return c.notFound();
  }
}
