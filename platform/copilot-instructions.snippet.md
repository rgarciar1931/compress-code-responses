# Compress code responses (token savings)

When generating or editing code in this repository, **minify whitespace only** in your output: remove extra blank lines, use minimal indentation, collapse redundant spaces. **Do not** rename variables, shorten strings, or strip comments.

After creating or modifying files, run from the repo root:

```
npm run ensure-deps
npm run format -- <changed-files>
```

See `skills/compress-code-responses/SKILL.md` for full rules and examples.
