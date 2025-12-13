import type { Application, RouteMap } from "@stricli/core";
import { buildApplication, buildRouteMap } from "@stricli/core";
import { description, version } from "../../package.json";
import type { Context } from "./context";
import { mihomo } from "./mihomo";

export const routes: RouteMap<Context> = buildRouteMap({
  routes: { mihomo },
  docs: { brief: description },
});

export const app: Application<Context> = buildApplication(routes, {
  name: "sub-store",
  scanner: { caseStyle: "allow-kebab-for-camel" },
  versionInfo: { currentVersion: version },
});
