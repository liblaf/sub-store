import type { HonoOpenAPIRouterType, OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";
import type { RouteOptions } from "./_abc";

export function registerRoute<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  route: typeof OpenAPIRoute<any> & RouteOptions,
): HonoOpenAPIRouterType<E, S, BasePath> {
  return openapi[route.method](route.path, route);
}
