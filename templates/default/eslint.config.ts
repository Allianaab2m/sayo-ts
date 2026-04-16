import tsParser from "@typescript-eslint/parser"
import sayo from "@sayo-ts/eslint-plugin"

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
  },
  sayo.configs.recommended,
]
