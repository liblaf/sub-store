import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["./worker/index.ts"],
  format: ["esm"],
  minify: true,
  dts: true,
  target: "bun",
  sourcemap: "linked",
  shims: true,
  exports: true,
  unused: true,
});
