import type { MiddlewareHandler, Next } from "hono";
import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import type { Context } from "../_utils";

export const auth: MiddlewareHandler = createMiddleware(
  async (c: Context, next: Next): Promise<Response | undefined> => {
    const token: string | undefined =
      c.req.query("token") ??
      c.req.header("Authorization")?.replace("Bearer ", "");
    const validToken: string = env(c).API_TOKEN;
    if (!token) return c.body(null, 401);
    if (token !== validToken) return c.body(null, 403);
    await next();
  },
);
