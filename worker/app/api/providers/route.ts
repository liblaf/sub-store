import type { HonoOpenAPIRouterType } from "chanfana";
import type { Env, Schema } from "hono";
import { register } from "../../_utils";
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
  register(openapi, CreateProvider);
  register(openapi, ReadProvider);
  register(openapi, DeleteProvider);
  register(openapi, ListProviders);
}
