import type { Context } from "hono";
import type { MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { bearerAuth } from "hono/bearer-auth";

export const auth: MiddlewareHandler = bearerAuth({
  verifyToken(token: string, c: Context<{ Bindings: Env }>): boolean {
    return token === env(c).SUB_STORE_TOKEN;
  },
});
