import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { registerProfilesRoutes } from "./profiles";

export function registerApiRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): HonoOpenAPIRouterType<E, S, BasePath> {
  openapi = registerProfilesRoutes(openapi);
  return openapi;
}
