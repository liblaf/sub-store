import { defineConfig } from "bunup";
import { exports, shims } from "bunup/plugins";

export default defineConfig({
  entry: ["src/index.ts", "src/bin/sub-store.ts"],
  format: ["esm"],
  minify: true,
  dts: true,
  target: "bun",
  sourcemap: "linked",
  onSuccess: "bun run 'scripts/gen-schemas.ts'",
  plugins: [shims(), exports()],
  preferredTsconfigPath: ".config/copier/tsconfig.build.json",
});
