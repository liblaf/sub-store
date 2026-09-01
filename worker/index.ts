import { Hono } from "hono";

import { serveSubscription } from "./routes/subscribe";

const app = new Hono<{ Bindings: Env }>();
app.get("/subs/:id/:filename", serveSubscription);

export default app;
