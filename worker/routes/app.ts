import { Scalar } from "@scalar/hono-api-reference";
import { ApiException, fromHono } from "chanfana";
import type { Context } from "hono";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { bearerAuth } from "hono/bearer-auth";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { description, version } from "../../package.json";
import { registerLLMRoutes } from "./llms";
import { registerProviderRoutes } from "./provider";
import { RouteSubscribe } from "./subscribe";

export function createApp(): Hono<{ Bindings: CloudflareBindings }> {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  const openapi = fromHono(app, {
    schema: {
      info: {
        title: "Subscription Store API",
        description,
        version,
      },
    },
  });

  openapi.onError((err, c) => {
    console.error(err);
    if (err instanceof HTTPException) {
      const response = err.getResponse();
      response.headers.set("X-Error-Message", err.message);
      return response;
    }
    if (err instanceof ApiException)
      return c.json(err.buildResponse(), err.status as ContentfulStatusCode);
    return c.text(`${err}`, 500);
  });

  openapi.get("/", Scalar({ url: "/openapi.json" }));
  registerLLMRoutes(app, openapi);

  openapi.get("/subscribe/:filename", RouteSubscribe);

  openapi.use(
    "/api/*",
    bearerAuth({
      verifyToken(token: string, c: Context<{ Bindings: CloudflareBindings }>) {
        return token === env(c).API_TOKEN;
      },
    }),
  );
  registerProviderRoutes(openapi);

  return app;
}
