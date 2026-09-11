import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";

import { MAX_UPLOAD_BYTES } from "@/lib/publish/schema";

import { serveSubscription } from "./routes/subscribe";
import { uploadArtifacts } from "./routes/upload";

const app = new Hono<{ Bindings: Env }>();
app.get("/subs/:id/:filename", serveSubscription);
app.put(
  "/api/profiles/:id/artifacts",
  async (c, next): Promise<Response | void> => {
    if (!c.env.SUB_STORE_API_TOKEN) return c.text("Unauthorized", 401);
    return bearerAuth<{ Bindings: Env }>({ token: c.env.SUB_STORE_API_TOKEN })(c, next);
  },
  bodyLimit({ maxSize: MAX_UPLOAD_BYTES }),
  uploadArtifacts,
);

export default app;
