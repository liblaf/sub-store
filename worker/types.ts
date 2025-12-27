import type * as hono from "hono";

export type Context = hono.Context<{ Bindings: CloudflareBindings }>;
