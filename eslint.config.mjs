import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts", "**/.turbo/**"],
  },
  {
    rules: {
      // Allow explicit any in places where we genuinely need it (tool args, JSON, etc.)
      "@typescript-eslint/no-explicit-any": "warn",
      // Don't require explicit return types everywhere — too verbose for small utilities
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Allow empty catch blocks with a comment
      "@typescript-eslint/no-empty-function": "warn",
      // Unused vars: error on variables, warn on args (common in express handlers)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Allow require() in server-manager and other CJS-specific code
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
);
