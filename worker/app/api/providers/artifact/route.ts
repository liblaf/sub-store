import { register } from "@worker/utils/route";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { DownloadProviderMihomo } from "./mihomo";
import { UploadProviderArtifact } from "./upload";

export function registerProviderArtifactRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  register(openapi, DownloadProviderMihomo, UploadProviderArtifact);
}
