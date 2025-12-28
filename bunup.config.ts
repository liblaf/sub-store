import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["./cli/bin/sub-store.ts"],
  format: ["esm"],
  minify: true,
  dts: true,
  target: "bun",
  sourcemap: "linked",
  shims: true,
  exports: true,
  unused: true,
});
