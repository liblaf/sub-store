import { register } from "@worker/utils/route";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { UploadProfileArtifact } from "./upload";

export function registerProfileArtifactRoutes<
  E extends Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  register(openapi, UploadProfileArtifact);
}
