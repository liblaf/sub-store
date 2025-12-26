import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { auth } from "../../middleware";
import { registerProfilesRoutes } from "./profiles";
import { registerProvidersRoutes } from "./providers/route";

export function registerApiRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  openapi.use("/api/*", auth);
  registerProfilesRoutes(openapi);
  registerProvidersRoutes(openapi);
}
