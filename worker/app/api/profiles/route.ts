import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { register } from "../../_utils";
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
  register(openapi, CreateProfile);
  register(openapi, ReadProfile);
  register(openapi, DeleteProfile);
  register(openapi, ListProfiles);
  registerProfileArtifactsRoutes(openapi);
}
