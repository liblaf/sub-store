import base from "@liblaf/config/bunup";
import { defineConfig } from "bunup";
import type { DefineConfigItem } from "bunup";

export default defineConfig({
  ...base,
  entry: ["./cli/bin/sub-store.ts"],
  external: ["zod"],
  unused: {
    ignore: ["commander", "zod"],
  },
}) as DefineConfigItem;
