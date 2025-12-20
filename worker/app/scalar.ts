import { Scalar } from "@scalar/hono-api-reference";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";

export function registerScalarRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): HonoOpenAPIRouterType<E, S, BasePath> {
  openapi.get("/", Scalar({ url: "/openapi.json" }));
  return openapi;
}
