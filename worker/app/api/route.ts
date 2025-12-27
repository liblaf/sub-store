import { auth } from "@worker/middleware/auth";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { registerProfileRoutes } from "./profile/route";
import { registerProviderRoutes } from "./provider/route";

export function registerApiRoutes<
  E extends Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  openapi.use("/api/*", auth);
  registerProfileRoutes(openapi);
  registerProviderRoutes(openapi);
}
