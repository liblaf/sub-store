import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { register } from "../../../_utils";
import { DeleteProfileArtifact } from "./delete";
import { UploadProfileArtifact } from "./upload";

export function registerProfileArtifactsRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  register(openapi, UploadProfileArtifact);
  register(openapi, DeleteProfileArtifact);
}
