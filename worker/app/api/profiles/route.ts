import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { CreateProfile } from "./create";
import { DeleteProfile } from "./delete";
import { ListProfiles } from "./list";

export function registerProfilesRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): HonoOpenAPIRouterType<E, S, BasePath> {
  CreateProfile.register(openapi);
  DeleteProfile.register(openapi);
  ListProfiles.register(openapi);
  return openapi;
}
