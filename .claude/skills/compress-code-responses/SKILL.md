---
name: compress-code-responses
description: >-
  Minifies whitespace in code output (not identifiers) to reduce completion tokens,
  then restores readable formatting locally with Prettier. Use for every request that
  returns or edits code, config, markup, or structured data (js, ts, php, phtml, html,
  xml, yaml, json, css, etc.). Applies automatically when writing files or code blocks.
---

# Compress Code Responses

Return **format-minified** output to save tokens. Minification means **whitespace and line breaks only** — never rename variables, never shorten strings, never remove comments unless the user asked.

## Minification rules

1. **Identifiers unchanged** — keep every variable, function, class, and property name.
2. **Logic unchanged** — same statements, same order, same semantics.
3. **Compress layout only**:
   - Remove blank lines except the minimum required for valid syntax.
   - Use the smallest indentation that keeps the file parseable (often 0–1 spaces).
   - Collapse multiple spaces to one where the language allows.
   - No trailing spaces.
4. **Scope**: minify every code block, snippet, and file content you output. Minify prose only when it lives inside a file Prettier will format (e.g. `.md` with fenced blocks — minify the blocks, not the narrative).
5. **Do not** use JS/CSS bundler minification (no `{a:1}` obfuscation, no mangled names).

### Example (JavaScript)

Readable (avoid sending this):

```javascript
function greet(name) {
  const message = `Hello, ${name}!`;

  return message;
}
```

Minified output (send this):

```javascript
function greet(name){const message=`Hello, ${name}!`;return message;}
```

After local Prettier, the readable form is restored.

## After writing or editing files

Always run formatting from the **project root** that contains this skill (or the repo where `compress-code-responses` is installed):

```bash
npm run ensure-deps
npm run format -- <paths-you-changed>
```

On first use in a session or machine, `ensure-deps` installs Prettier and plugins. Later calls only need `format`.

Windows (PowerShell):

```powershell
npm run ensure-deps
npm run format -- path/to/file.php path/to/file.js
```

Format **every** file you created or modified before finishing the task.

## Supported file types

Prettier handles: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.json`, `.jsonc`, `.yaml`, `.yml`, `.html`, `.htm`, `.xml`, `.svg`, `.css`, `.scss`, `.less`, `.md`, `.mdx`, `.php`, `.phtml`, and common variants.

If a path is unsupported, skip formatting and leave the minified content as-is.

## Workflow checklist

```
- [ ] Output minified code in responses and file writes
- [ ] Run npm run ensure-deps (once per environment)
- [ ] Run npm run format -- on all changed paths
- [ ] Verify files parse and match intended behavior
```

## Non-goals

- Do not minify secrets or `.env` contents in chat if the user did not ask to edit them.
- Do not skip formatting because output "looks fine" — always run the format script for changed supported files.
