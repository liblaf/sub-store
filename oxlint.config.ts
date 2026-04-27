import base from "@liblaf/config/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  env: {
    node: true,
  },
  rules: {
    "eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
  },
  options: {
    reportUnusedDisableDirectives: "warn",
    typeAware: true,
    typeCheck: true,
  },
});
