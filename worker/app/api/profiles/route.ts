import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { registerRoute } from "../../_utils";
import { registerProfileArtifactsRoutes } from "./artifacts";
import {
  CreateProfile,
  DeleteProfile,
  ListProfiles,
  ReadProfile,
} from "./endpoints";

export function registerProfilesRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  registerRoute(openapi, CreateProfile);
  registerRoute(openapi, ReadProfile);
  registerRoute(openapi, DeleteProfile);
  registerRoute(openapi, ListProfiles);
  registerProfileArtifactsRoutes(openapi);
}
