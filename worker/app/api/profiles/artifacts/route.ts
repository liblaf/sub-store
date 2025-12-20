import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { DeleteProfileArtifact } from "./delete";
import { UploadProfileArtifact } from "./upload";

export function registerProfileArtifactsRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): HonoOpenAPIRouterType<E, S, BasePath> {
  openapi = DeleteProfileArtifact.register(openapi);
  openapi = UploadProfileArtifact.register(openapi);
  return openapi;
}
