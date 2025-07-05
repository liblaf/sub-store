import { buildApplication, buildRouteMap } from "@stricli/core";
import { description, version } from "../../package.json";
import { mihomo } from "./mihomo";

const routes = buildRouteMap({
  routes: { mihomo },
  docs: { brief: description },
});

export const app = buildApplication(routes, {
  name: "sub-store",
  versionInfo: { currentVersion: version },
});
