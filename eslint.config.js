export default [
  {
    ignores: ["dist/**", "node_modules/**", ".manus-logs/**", "**/*.d.ts", "**/*.ts", "**/*.tsx"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "off"
    },
  },
];
