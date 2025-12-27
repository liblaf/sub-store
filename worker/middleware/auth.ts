import type { Context } from "@worker/types";
import type { MiddlewareHandler, Next } from "hono";
import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";

export const auth: MiddlewareHandler = createMiddleware(
  async (c: Context, next: Next): Promise<Response | undefined> => {
    const token: string | undefined =
      c.req.query("token") ??
      c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return c.body(null, 401);
    if (token !== env(c).API_TOKEN) return c.body(null, 403);
    await next();
  },
);
