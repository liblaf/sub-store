import type { HonoOpenAPIRouterType, OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";
import type { Context } from "../_utils";

export type RequestMethod = "get" | "delete" | "patch" | "post" | "put";

export interface RouteOptions {
  method: RequestMethod;
  path: string;
}

export function getContext(route: OpenAPIRoute): Context {
  return route.args[0];
}

export function register<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  route: typeof OpenAPIRoute<any> & RouteOptions,
): HonoOpenAPIRouterType<E, S, BasePath> {
  return openapi[route.method](route.path, route);
}
