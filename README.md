# compress-code-responses

Reduce AI **output token cost** by having the model return **format-minified** code (whitespace and line breaks only), then restore readable formatting **locally** with Prettier.

Works with:

| Tool | How it loads instructions |
|------|---------------------------|
| **Cursor** | `.cursor/skills/compress-code-responses/SKILL.md` (auto-invoke when omitted `disable-model-invocation`) |
| **OpenCode** | `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/` |
| **GitHub Copilot CLI** | `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md` |
| **PHPStorm + Copilot** | Same `.github/` files as Copilot CLI ([details](platform/phpstorm/README.md)) |

## How it works

1. **Model output** — Code is sent with minimal indentation, blank lines, and spacing. Variable names, strings, and logic stay the same.
2. **Local restore** — After files are written, run Prettier (with PHP, YAML, HTML, XML, JSON, JS, etc. plugins) to format them back.

You pay fewer completion tokens; your repo still gets normally formatted code.

## Quick start

```bash
git clone https://github.com/YOUR_USER/compress-code-responses.git
cd compress-code-responses
npm install
npm run install-skill
npm run ensure-deps
```

### Use in your own project

**Option A — Git submodule or copy**

Copy this repo (or submodule) into your project and run `npm run install-skill` from its root.

**Option B — Global install (all repos)**

```bash
npm run install-skill   # also writes ~/.cursor/skills/, ~/.claude/skills/, ~/.copilot/, etc.
```

**Option C — Vendor only the skill**

Copy `skills/compress-code-responses/` to your project's `.cursor/skills/` (and/or `.claude/skills/`).

## Formatting after AI edits

From the directory that contains this package:

```bash
npm run ensure-deps          # first time only — installs Prettier + plugins
npm run format -- src/foo.js src/bar.php
```

Check without writing:

```bash
npm run format:check -- src/foo.js
```

## Platform setup

### Cursor

1. Run `npm run install-skill` (installs to `.cursor/skills/compress-code-responses/`).
2. The skill omits `disable-model-invocation`, so Cursor can apply it automatically on code tasks.
3. Ensure the agent runs `npm run format -- <files>` after edits (instructed in the skill).

### OpenCode

Skill paths (any one works):

- `.opencode/skills/compress-code-responses/SKILL.md`
- `.claude/skills/compress-code-responses/SKILL.md`
- `.agents/skills/compress-code-responses/SKILL.md`

Global: `~/.config/opencode/skills/` or `~/.claude/skills/`.

### GitHub Copilot CLI / VS Code / PHPStorm

`npm run install-skill` writes:

- `.github/copilot-instructions.md`
- `.github/instructions/compress-code-responses.instructions.md` (auto-applies to code file globs)

Global Copilot instructions: `~/.copilot/copilot-instructions.d/compress-code-responses.md`

## Supported formats

Prettier (via this repo's config): **JS/TS**, **JSON**, **YAML**, **HTML**, **XML**, **CSS**, **Markdown**, **PHP**, **PHTML**, and related extensions.

## Token comparison tests

Simulates “with skill” vs “without skill” using [tiktoken](https://github.com/openai/tiktoken) (`cl100k_base`):

```bash
npm install
npm run test:token-comparison
```

For each sample (JS, PHP, JSON) it prints:

- Token and character counts (formatted vs minified)
- Percent difference
- Three output files under `test-output/token-comparison/`:
  - `*-1-no-skill-formatted.txt` — baseline
  - `*-2-skill-raw-minified.txt` — simulated model output
  - `*-3-skill-plus-prettier.txt` — after local Prettier

Unit tests:

```bash
npm test
```

## Project layout

```
compress-code-responses/
├── skills/compress-code-responses/SKILL.md   # source of truth
├── scripts/
│   ├── ensure-deps.js                        # install Prettier on first use
│   ├── format.js                             # run Prettier
│   └── install-skill.js                      # deploy to all platforms
├── platform/                                 # Copilot / PHPStorm snippets
├── lib/minify-whitespace.js                  # test benchmark helper
├── tests/
│   ├── fixtures/
│   ├── minify.test.js
│   └── token-comparison.js
├── prettier.config.js
└── README.md
```

## Limitations

- **Prose** in chat is not restored by Prettier; savings are largest on code-heavy responses.
- **Copilot chat** does not run shell commands — you (or your agent) must run `npm run format` after accepting edits.
- Minification is **instruction-based**; models may occasionally send readable code — the skill still applies local formatting.

## License

MIT
