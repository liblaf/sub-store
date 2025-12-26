import { registerRoute } from "@worker/app/_utils";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { UploadProfileArtifact } from "./upload";

export function registerProfileArtifactsRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  registerRoute(openapi, UploadProfileArtifact);
}
