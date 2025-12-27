import "./prelude";
import type { Hono } from "hono";
import { createApp } from "./app/route";

const app: Hono<{ Bindings: CloudflareBindings }> = createApp();

export default app;
