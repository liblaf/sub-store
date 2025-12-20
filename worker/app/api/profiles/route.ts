import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { CreateProfile } from "./create";
import { DeleteProfile } from "./delete";

export function registerProfilesRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): HonoOpenAPIRouterType<E, S, BasePath> {
  openapi = CreateProfile.register(openapi);
  openapi = DeleteProfile.register(openapi);
  return openapi;
}
