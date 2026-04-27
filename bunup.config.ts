import base from "@liblaf/config/bunup";
import { defineConfig } from "bunup";
import type { DefineConfigItem } from "bunup";

export default defineConfig({
  ...base,
  entry: ["./cli/bin/sub-store.ts"],
  unused: {
    ignore: ["commander"],
  },
}) as DefineConfigItem;
