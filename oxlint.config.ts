import base from "@liblaf/config/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  rules: {
    "eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
  },
  options: {
    reportUnusedDisableDirectives: "warn",
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ["./cli/**", "./lib/**"],
      env: {
        node: true,
      },
    },
  ],
});
