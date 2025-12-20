import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { NotFoundException, OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";
import z from "zod";
import type { Context } from "../../../../types";

export class DeleteProfileArtifact extends OpenAPIRoute {
  static register<
    E extends Env = Env,
    S extends Schema = Schema,
    BasePath extends string = "/",
  >(
    openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  ): HonoOpenAPIRouterType<E, S, BasePath> {
    openapi.delete("/api/profiles/:id/:filename", DeleteProfileArtifact);
    return openapi;
  }

  override schema = {
    request: {
      params: z.object({
        id: z.uuid(),
        filename: z
          .string()
          .openapi({ examples: ["mihomo.yaml", "stash.yaml"] }),
      }),
    },
    responses: {
      204: { description: "No Content" },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    return c.body(null, 501);
  }
}
