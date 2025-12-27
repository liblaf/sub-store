import type { HonoOpenAPIRouterType, OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";

export type RequestMethod = "get" | "post" | "put" | "delete" | "patch";

export interface RouteOptions {
  method: RequestMethod;
  path: string;
}

export function register<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  ...endpoints: Array<typeof OpenAPIRoute<any> & RouteOptions>
): void {
  for (const endpoint of endpoints)
    openapi.on(endpoint.method, endpoint.path, endpoint);
}
