/** @type {import("prettier").Config} */
export default {
  plugins: ["@prettier/plugin-php", "prettier-plugin-tailwindcss"],
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  overrides: [
    {
      files: ["*.php", "*.phtml"],
      options: {
        parser: "php",
        phpVersion: "8.2",
      },
    },
    {
      files: ["*.json", "*.jsonc"],
      options: { parser: "json" },
    },
    {
      files: ["*.yaml", "*.yml"],
      options: { parser: "yaml" },
    },
    {
      files: ["*.html", "*.htm"],
      options: { parser: "html" },
    },
    {
      files: ["*.xml", "*.svg"],
      options: { parser: "xml" },
    },
    {
      files: ["*.md", "*.mdx"],
      options: { parser: "markdown", proseWrap: "preserve" },
    },
  ],
};
