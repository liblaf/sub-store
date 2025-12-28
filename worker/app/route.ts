import { description, version } from "@package.json";
import { Scalar } from "@scalar/hono-api-reference";
import type { Context } from "@worker/types";
import type { HonoOpenAPIRouterType } from "chanfana";
import { ApiException, fromHono } from "chanfana";
import type { Env, Schema } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HTTPResponseError } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { registerApiRoutes } from "./api/route";
import { registerLlmsRoutes } from "./llms";
import { registerSubscribeRoutes } from "./subscribe";

export function createApp(): Hono<{ Bindings: CloudflareBindings }> {
  const app = new Hono<{ Bindings: CloudflareBindings }>();

  app.get("/", Scalar({ url: "/openapi.json" }));

  const openapi: HonoOpenAPIRouterType<{ Bindings: CloudflareBindings }> =
    fromHono(app, {
      schema: {
        info: {
          title: "Subscription Store API",
          description,
          version,
        },
      },
    });

  openapi.onError(
    async (err: Error | HTTPResponseError, c: Context): Promise<Response> => {
      if (err instanceof ApiException) {
        return c.json(
          { success: false, errors: err.buildResponse() },
          err.status as ContentfulStatusCode,
        );
      }
      if (err instanceof HTTPException) {
        c.header("X-Error-Message", err.message);
        return err.getResponse();
      }
      return c.text(`${err}`, 500);
    },
  );

  registerRoutes(openapi);

  return app;
}

export function registerRoutes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  registerLlmsRoutes(openapi);
  registerApiRoutes(openapi);
  registerSubscribeRoutes(openapi);
}
