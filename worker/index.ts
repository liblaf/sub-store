import { fromHono } from "chanfana";
import type { HonoOpenAPIRouterType } from "chanfana";
import { Hono } from "hono";

import { routeProxy } from "./routes/proxy";
import { RouteSubscribe } from "./routes/subscribe";

const app = new Hono<{ Bindings: Env }>();
const openapi: HonoOpenAPIRouterType<{ Bindings: Env }> = fromHono(app);
openapi.get("/subscribe/:filename", RouteSubscribe);
openapi.get("/proxy/:path{.+}", routeProxy);

export default app;
