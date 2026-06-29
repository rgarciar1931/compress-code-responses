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

## Adobe Commerce / Magento compatibility

This skill extends Prettier configuration specifically for Adobe Commerce
development:

- **XML config files**: `di.xml`, `module.xml`, `routes.xml`, `db_schema.xml`,
  `acl.xml`, `events.xml`, `webapi.xml`, `layout.xml`, `csp_whitelist.xml` and
  many others are recognized and formatted with the XML parser.
- **GraphQL schemas**: `.graphql` and `.graphqls` files are supported for
  Magento 2 GraphQL module development.
- **PHTML templates**: `.phtml` files use the PHP parser.
- **Custom XSD files**: `fieldgroups.xsd`, `filters.xsd`, and other Magento
  schema files are handled as XML.

### Adobe Commerce fixture benchmark

Fixture benchmarks use sanitized test data (no real project references):

| Fixture                                                   | Lines | Chars no skill | Chars skill | Token reduction |
| --------------------------------------------------------- | ----- | -------------- | ----------- | --------------- |
| `sample-adobe-service.php` (Adobe service with DI)        | 185   | 5,789          | 4,944       | 15.6%           |
| `sample-adobe-di.xml` (DI config with 15+ comments)       | 188   | 7,453          | 5,578       | 20.2%           |
| `sample-adobe-schema.graphqls` (GraphQL schema with docs) | 250   | 5,101          | 4,703       | 12.6%           |

Adobe Commerce DI XML with 15+ comment blocks achieves **~20% token savings**
while preserving comments and XML structure.

For Adobe Commerce fixture benchmarks:

```bash
node tests/adobe-commerce-benchmark.js
```

## How it works

1. Model output: code is sent with minimal indentation, blank lines, and spacing.
   Variable names, strings, comments, and logic stay the same.
2. Local restore: after files are written, run Prettier with this repo's config
   to format them back.

You pay fewer completion tokens; your repo still gets normally formatted code.

## Quick start

Install the Adobe Commerce / Magento 2 variant:

```bash
git clone https://github.com/rgarciar1931/compress-code-responses.git
cd compress-code-responses
git checkout adobe-commerce
npm install
npm run install-skill
npm run ensure-deps
```

Use `master` or tag `v1.0.0` for the generic release, and
`v1.0.0-adobe` for the Adobe Commerce release.

### Install from specific version tags

```bash
# Generic stable release
git clone https://github.com/rgarciar1931/compress-code-responses.git
cd compress-code-responses
git checkout v1.0.0

# Adobe Commerce release
git clone https://github.com/rgarciar1931/compress-code-responses.git
cd compress-code-responses
git checkout v1.0.0-adobe
```

On Windows PowerShell, if script execution policy blocks `npm`, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run install-skill
npm.cmd run ensure-deps
```

`npm run install-skill` writes user-level copies under paths such as
`~/.cursor/skills/`,
`~/.claude/skills/`, `~/.agents/skills/`, `~/.config/opencode/skills/`, and
`~/.copilot/copilot-instructions.d/`.

To vendor only the skill in one project, copy
`skills/compress-code-responses/` to that project's `.cursor/skills/`,
`.claude/skills/`, `.agents/skills/`, or `.opencode/skills/` directory.

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

Tests compare "without skill" (normal Prettier output) vs "with skill"
(whitespace minified, then re-formatted):

| Sample               | Normal Token | Compressed Token | Savings   |
| -------------------- | ------------ | ---------------- | --------- |
| JavaScript           | 462 tokens   | 370 tokens       | **19.9%** |
| PHP                  | 630 tokens   | 462 tokens       | **26.7%** |
| JSON                 | 323 tokens   | 216 tokens       | **33.1%** |
| Adobe PHP Service    | 1,502 tokens | 1,268 tokens     | **15.6%** |
| Adobe DI XML         | 1,379 tokens | 1,101 tokens     | **20.2%** |
| Adobe GraphQL Schema | 1,293 tokens | 1,130 tokens     | **12.6%** |
| **Overall Average**  | 1,063 tokens | 774 tokens       | **27.2%** |

The local benchmark uses tiktoken (OpenAI tokenizer) for accurate counts with
`cl100k_base` (GPT-3.5/GPT-4 family).

Run local benchmark:

```bash
npm test
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

### API benchmarks

For actual OpenAI API token usage:

```bash
export OPENAI_API_KEY='sk-xxxxxx'
node tests/api-benchmark-real.js
```

For realistic token usage data without API credentials:

```bash
node tests/api-benchmark-tiktoken.js
```

For multi-provider runs, set the provider keys you want to use and run:

```bash
export OPENROUTER_API_KEY='sk-or-v1-...'
export CEREBRAS_API_KEY='csk-...'
export NVIDIA_API_KEY='nvapi-...'
node tests/api-benchmark-multi-provider.js
```

API benchmarks compare the same prompts with and without compression
instructions. Results vary by model and free-tier availability; Adobe Commerce
PHP and XML samples have typically shown the strongest savings.

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
CSS, Markdown, PHP, PHTML, GraphQL, and Adobe Commerce/Magento file types:

- **PHP**: `.php`, `.phtml`
- **XML** (Adobe Commerce): `di.xml`, `module.xml`, `routes.xml`, `db_schema.xml`,
  `acl.xml`, `events.xml`, `webapi.xml`, `layout.xml`, `config.xml`, `xsd/*`
- **GraphQL**: `.graphql`, `.graphqls`
- **JSON**: `.json`, `.jsonc`
- **YAML**: `.yaml`, `.yml`
- **HTML/Markdown**: `.html`, `.htm`, `.md`, `.mdx`

## Tests

```bash
npm test
npm run test:token-comparison
node tests/adobe-commerce-benchmark.js
```

`npm test` runs the unit tests with explicit file paths for consistent behavior
on Windows, macOS, and Linux. The Adobe Commerce benchmark can use sanitized
fixtures or real files through `ADOBE_PROJECT_PATH`.

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
|   |   |-- sample.js
|   |   |-- sample.php
|   |   |-- sample.json
|   |   |-- sample-adobe-service.php  (Adobe Commerce PHP service class)
|   |   |-- sample-adobe-di.xml       (Adobe Commerce DI config)
|   |   `-- sample-adobe-schema.graphqls
|   |-- equivalent.test.js
|   |-- minify.test.js
|   |-- token-comparison.js
|   |-- api-benchmark-real.js
|   |-- api-benchmark-tiktoken.js
|   |-- api-benchmark-multi-provider.js
|   `-- adobe-commerce-benchmark.js
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
