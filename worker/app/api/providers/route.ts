import { registerRoute } from "@worker/app/_utils";
import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { registerProviderArtifactRoutes } from "./artifacts";
import {
  CreateProvider,
  DeleteProvider,
  ListProviders,
  ReadProvider,
} from "./endpoints";

export function registerProvidersRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  registerRoute(openapi, CreateProvider);
  registerRoute(openapi, ReadProvider);
  registerRoute(openapi, DeleteProvider);
  registerRoute(openapi, ListProviders);
  registerProviderArtifactRoutes(openapi);
}
