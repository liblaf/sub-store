import base from "@liblaf/config/bunup";
import { defineConfig } from "bunup";
import type { DefineConfigItem } from "bunup";

export default defineConfig({
  ...base,
  // The Bun shebang enables fast loading; this target also escapes Unicode in bundled modules.
  target: "bun",
  entry: ["./cli/bin/sub-store.ts"],
  external: ["zod"],
  unused: {
    ignore: ["commander", "zod"],
  },
}) as DefineConfigItem;
