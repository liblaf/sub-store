import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";
import type { Context } from "../../../types";
import type { Profiles } from "./schema";
import { PROFILES_SCHEMA } from "./schema";
import { getProfiles } from "./utils";

export class ListProfiles extends OpenAPIRoute {
  static register<
    E extends Env = Env,
    S extends Schema = Schema,
    BasePath extends string = "/",
  >(
    openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  ): HonoOpenAPIRouterType<E, S, BasePath> {
    openapi.get("/api/profiles", ListProfiles);
    return openapi;
  }

  override schema = {
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: PROFILES_SCHEMA,
          },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const profiles: Profiles = await getProfiles(c);
    return c.json(profiles);
  }
}
