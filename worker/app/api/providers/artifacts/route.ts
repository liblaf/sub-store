import { registerRoute } from "@worker/app/_utils";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { ReadProviderArtifactMihomo } from "./mihomo";
import { ReadProviderArtifact } from "./read";
import { UploadProviderArtifact } from "./upload";

export function registerProviderArtifactRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  registerRoute(openapi, ReadProviderArtifactMihomo);
  registerRoute(openapi, ReadProviderArtifact);
  registerRoute(openapi, UploadProviderArtifact);
}
