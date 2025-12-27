import { register } from "@worker/utils/route";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { registerProfileArtifactRoutes } from "./artifact/route";
import {
  CreateProfile,
  DeleteProfile,
  ListProfiles,
  ReadProfile,
} from "./endpoints";

export function registerProfileRoutes<
  E extends Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  register(openapi, CreateProfile, ReadProfile, DeleteProfile, ListProfiles);
  registerProfileArtifactRoutes(openapi);
}
