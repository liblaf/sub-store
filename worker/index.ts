import { fromHono } from "chanfana";
import type { HonoOpenAPIRouterType } from "chanfana";
import { Hono } from "hono";

import { auth } from "./middleware/auth";
import { RouteApiUpload } from "./routes/api/upload";
import { RouteSubscribe } from "./routes/subscribe";

const app = new Hono<{ Bindings: Env }>();
const openapi: HonoOpenAPIRouterType<{ Bindings: Env }> = fromHono(app);
openapi.use("/api/*", auth);
openapi.post("/api/upload/:filename", RouteApiUpload);
openapi.get("/subscribe/:filename", RouteSubscribe);

export default app;
