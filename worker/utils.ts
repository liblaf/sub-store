import type { OpenAPIRoute } from "chanfana";
import type { Context } from "hono";

export function getContext(
  route: OpenAPIRoute,
): Context<{ Bindings: CloudflareBindings }> {
  return route.args[0] as Context<{ Bindings: CloudflareBindings }>;
}
