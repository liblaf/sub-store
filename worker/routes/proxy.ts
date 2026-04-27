import { ForbiddenException } from "chanfana";
import type { Context } from "hono";
import { proxy } from "hono/proxy";

const PREFIX_WHITELIST: string[] = [
  "github.com/Zephyruso/zashboard/",
  "raw.githubusercontent.com/liblaf/",
  "raw.githubusercontent.com/MetaCubeX/meta-rules-dat/",
];

export async function routeProxy(
  c: Context<{ Bindings: Env }, "/proxy/:path{.+}">,
): Promise<Response> {
  const path: string = c.req.param("path");
  if (!PREFIX_WHITELIST.some((prefix: string): boolean => path.startsWith(prefix))) {
    throw new ForbiddenException();
  }
  return proxy(`https://${path}`, { headers: c.req.header() });
}
