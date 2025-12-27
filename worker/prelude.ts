import { extendZodWithOpenApi, OpenAPIRoute } from "chanfana";
import { env } from "hono/adapter";
import { z } from "zod/v3";
import type { Context } from "./types";

extendZodWithOpenApi(z);

declare module "chanfana" {
  interface OpenAPIRoute {
    get ctx(): Context;
    get kv(): KVNamespace;
  }
}

export function extendChanfana(cls: typeof OpenAPIRoute): void {
  Object.defineProperty(cls.prototype, "ctx", {
    get(this: OpenAPIRoute): Context {
      return this.args[0];
    },
  });
  Object.defineProperty(cls.prototype, "kv", {
    get(this: OpenAPIRoute): KVNamespace {
      return env(this.ctx).SUB;
    },
  });
}

extendChanfana(OpenAPIRoute);
