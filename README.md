# compress-code-responses

Reduce AI output token cost by having the model return format-minified code
(whitespace and line breaks only), then restore readable formatting locally with
Prettier.

Works with:

| Tool               | How it loads instructions                                                     |
| ------------------ | ----------------------------------------------------------------------------- |
| Cursor             | `.cursor/skills/compress-code-responses/SKILL.md`                             |
| OpenCode           | `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/`                  |
| GitHub Copilot CLI | `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md`  |
| PHPStorm + Copilot | Same `.github/` files as Copilot CLI ([details](platform/phpstorm/README.md)) |

## How it works

1. Model output: code is sent with minimal indentation, blank lines, and spacing.
   Variable names, strings, comments, and logic stay the same.
2. Local restore: after files are written, run Prettier with this repo's config
   to format them back.

You pay fewer completion tokens; your repo still gets normally formatted code.

## Quick start

```bash
git clone https://github.com/rgarciar1931/compress-code-responses.git
cd compress-code-responses
npm install
npm run install-skill
npm run ensure-deps
```

On Windows PowerShell, if script execution policy blocks `npm`, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run install-skill
npm.cmd run ensure-deps
```

## Use in your own project

Option A: copy or submodule this repo into your project and run
`npm run install-skill` from its root.

Option B: install globally for all repos:

```bash
npm run install-skill
```

This writes user-level copies under paths such as `~/.cursor/skills/`,
`~/.claude/skills/`, `~/.agents/skills/`, `~/.config/opencode/skills/`, and
`~/.copilot/copilot-instructions.d/`.

Option C: vendor only the skill by copying `skills/compress-code-responses/` to
your project's `.cursor/skills/`, `.claude/skills/`, `.agents/skills/`, or
`.opencode/skills/` directory.

## Formatting after AI edits

From the directory that contains this package:

```bash
npm run ensure-deps
npm run format -- src/foo.js src/bar.php
```

Check without writing:

```bash
npm run format:check -- src/foo.js
```

## Token comparison

The benchmark simulates "without skill" as normally formatted code and "with
skill" as whitespace-minified model output, then verifies Prettier can restore a
layout-equivalent file locally.

Latest local run against richer JS, PHP, and JSON fixtures:

| Measure            | No skill | Skill raw | Reduction |
| ------------------ | -------- | --------- | --------- |
| Characters         | 5,231    | 4,059     | 22.4%     |
| OpenAI cl100k_base | 1,415    | 1,048     | 25.9%     |
| OpenAI o200k_base  | 1,424    | 1,091     | 23.4%     |
| OpenAI p50k_base   | 1,770    | 1,359     | 23.2%     |

Per sample:

| Sample     | Chars no skill | Chars skill | Char reduction | Restored |
| ---------- | -------------- | ----------- | -------------- | -------- |
| JavaScript | 1,869          | 1,505       | 19.5%          | yes      |
| PHP        | 2,221          | 1,688       | 24.0%          | yes      |
| JSON       | 1,141          | 866         | 24.1%          | yes      |

Run it yourself:

```bash
npm install
npm run test:token-comparison
```

The script writes detailed artifacts to `test-output/token-comparison/`:

- `*-1-no-skill-formatted.txt`: formatted baseline
- `*-2-skill-raw-minified.txt`: simulated model output
- `*-3-skill-plus-prettier.txt`: restored with local Prettier
- `summary.json` and `summary.md`: aggregate counts

OpenAI token counts are calculated locally with `tiktoken`. Character counts are
included as a provider-neutral proxy for providers that do not ship a stable
offline tokenizer in this repo.

## Platform setup

### Cursor

1. Run `npm run install-skill`.
2. The skill installs to `.cursor/skills/compress-code-responses/SKILL.md`.
3. Ensure the agent runs `npm run format -- <files>` after edits.

### OpenCode

Skill paths, any one of which works:

- `.opencode/skills/compress-code-responses/SKILL.md`
- `.claude/skills/compress-code-responses/SKILL.md`
- `.agents/skills/compress-code-responses/SKILL.md`

Global paths include `~/.config/opencode/skills/` and `~/.claude/skills/`.

### GitHub Copilot CLI / VS Code / PHPStorm

`npm run install-skill` writes:

- `.github/copilot-instructions.md`
- `.github/instructions/compress-code-responses.instructions.md`

Global Copilot instructions are written to
`~/.copilot/copilot-instructions.d/compress-code-responses.md`.

## Supported formats

Prettier, through this repo's config, supports JS/TS, JSON, YAML, HTML, XML,
CSS, Markdown, PHP, PHTML, and related extensions.

## Tests

```bash
npm test
npm run test:token-comparison
```

The `test` script uses explicit test file paths so it does not depend on shell
glob behavior across Windows, macOS, and Linux.

## Project layout

```text
compress-code-responses/
|-- skills/compress-code-responses/SKILL.md
|-- scripts/
|   |-- ensure-deps.js
|   |-- format.js
|   `-- install-skill.js
|-- platform/
|-- lib/
|-- tests/
|   |-- fixtures/
|   |-- equivalent.test.js
|   |-- minify.test.js
|   `-- token-comparison.js
|-- prettier.config.js
`-- README.md
```

## Limitations

- Prose in chat is not restored by Prettier; savings are largest on code-heavy
  responses.
- Copilot chat does not run shell commands; you or your agent must run
  `npm run format` after accepting edits.
- Minification is instruction-based; models may occasionally send readable code,
  and the local formatter still applies afterward.

## License

MIT
