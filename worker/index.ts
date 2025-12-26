import { extendZodWithOpenApi } from "chanfana";
import type { Hono } from "hono";
import { z } from "zod/v3";
import { createApp } from "./app";

extendZodWithOpenApi(z);

const app: Hono<{ Bindings: CloudflareBindings }> = createApp();

export default app;
