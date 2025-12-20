import type { Hono } from "hono";
import { createApp } from "./routes";

const app: Hono<{ Bindings: CloudflareBindings }> = createApp();

export default app;
