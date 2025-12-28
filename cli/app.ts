import { version } from "@package.json";
import type { CommandContext, RouteMap } from "@stricli/core";
import { buildApplication, buildRouteMap } from "@stricli/core";
import hello from "./cmd/hello";
import merge from "./cmd/merge";
import upload from "./cmd/upload";

const route: RouteMap<CommandContext> = buildRouteMap({
  docs: {
    brief: "",
  },
  routes: { hello, merge, upload },
});

export default buildApplication(route, {
  name: "sub-store",
  versionInfo: {
    currentVersion: version,
  },
  scanner: {
    caseStyle: "allow-kebab-for-camel",
  },
});
