import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin/sub-store.ts"],
  format: ["esm"],
  minify: true,
  dts: true,
  target: "bun",
  sourcemap: "linked",
  onSuccess: "bun run 'scripts/gen-schemas.ts'",
  exports: true,
  unused: true,
});
