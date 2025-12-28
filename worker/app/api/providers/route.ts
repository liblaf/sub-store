import { register } from "@worker/utils/route";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { registerProviderArtifactRoutes } from "./artifact/route";
import {
  CreateProvider,
  DeleteProvider,
  ListProviders,
  ReadProvider,
} from "./endpoints";

export function registerProviderRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  register(
    openapi,
    CreateProvider,
    ReadProvider,
    DeleteProvider,
    ListProviders,
  );
  registerProviderArtifactRoutes(openapi);
}
