/** @type {import("prettier").Config} */
export default {
  plugins: ["@prettier/plugin-php", "prettier-plugin-tailwindcss", "@prettier/plugin-xml"],
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
      options: { parser: "php" },
    },
    {
      files: ["*.json", "*.jsonc", "composer.json"],
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
      files: [
        "*.xml",
        "*.svg",
        // Adobe Commerce / Magento file patterns
        "**/etc/module.xml",
        "**/etc/di.xml",
        "**/etc/config.xml",
        "**/etc/routes.xml",
        "**/etc/frontend/routes.xml",
        "**/etc/adminhtml/routes.xml",
        "**/etc/acl.xml",
        "**/etc/csp_whitelist.xml",
        "**/etc/events.xml",
        "**/etc/db_schema.xml",
        "**/etc/webapi.xml",
        "**/etc/sales.xml",
        "**/etc/fieldgroups.xsd",
        "**/etc/filters.xsd",
        "**/etc/xsd/*",
        "**/view/**/*.xml",
        "**/view/**/*.xsd",
        "**/Plugin.xml",
        "**/Preference.xml",
        "**/source/**/etc/*.xml",
      ],
      options: { parser: "xml" },
    },
    {
      files: ["*.md", "*.mdx"],
      options: { parser: "markdown", proseWrap: "preserve" },
    },
    {
      files: ["*.graphql", "*.graphqls", "schema.graphqls"],
      options: { parser: "graphql" },
    },
  ],
};
