// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/generated/**",
      "eslint.config.js",
      "commitlint.config.cjs",
      "**/prisma/seed/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Test files use Node's built-in test runner (node:test / node:assert),
    // whose call signatures aren't fully resolvable by the type-aware rules.
    // Disable type-checked rules for tests — they don't need type-aware lint.
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**/*.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  eslintConfigPrettier,
);
