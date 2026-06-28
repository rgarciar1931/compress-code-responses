---
applyTo: "**/*.{js,jsx,ts,tsx,mjs,cjs,vue,svelte,php,phtml,html,htm,xml,svg,css,scss,less,json,jsonc,yaml,yml,md,mdx}"
---

# Compress code responses

Minify **format only** in code you return or write: minimal line breaks and indentation, unchanged identifiers and logic.

After file edits, run:

```
npm run ensure-deps
npm run format -- <paths>
```

Do not use bundler-style minification. Full rules: `skills/compress-code-responses/SKILL.md`.
