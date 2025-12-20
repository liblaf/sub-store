import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";
import z from "zod";
import type { Context } from "../../../types";

export class CreateProfile extends OpenAPIRoute {
  static register<
    E extends Env = Env,
    S extends Schema = Schema,
    BasePath extends string = "/",
  >(
    openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  ): HonoOpenAPIRouterType<E, S, BasePath> {
    openapi.post("/api/profiles/:id", CreateProfile);
    return openapi;
  }

  override schema = {
    request: {
      params: z.object({
        id: z.uuid(),
      }),
    },
    responses: {
      204: { description: "No Content" },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    return c.body(null, 501);
  }
}
