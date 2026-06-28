import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { get_encoding } from "tiktoken";
import { minifyWhitespace, countChars } from "../lib/minify-whitespace.js";
import { equivalentContent } from "../lib/equivalent.js";

function minifyForSample(source, file) {
  if (file.endsWith(".json")) {
    return JSON.stringify(JSON.parse(source));
  }

  return minifyWhitespace(source);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test-output", "token-comparison");
const tokenizers = [
  {
    provider: "OpenAI",
    label: "cl100k_base",
    note: "Common GPT-3.5/GPT-4 tokenizer family",
    encoding: get_encoding("cl100k_base"),
  },
  {
    provider: "OpenAI",
    label: "o200k_base",
    note: "Common GPT-4o/o-series tokenizer family",
    encoding: get_encoding("o200k_base"),
  },
  {
    provider: "OpenAI",
    label: "p50k_base",
    note: "Older Codex/text-davinci tokenizer family",
    encoding: get_encoding("p50k_base"),
  },
];

const samples = [
  { name: "javascript", file: "sample.js" },
  { name: "php", file: "sample.php" },
  { name: "json", file: "sample.json" },
];

function countTokens(encoding, text) {
  return encoding.encode(text).length;
}

function pctReduction(base, value) {
  if (base === 0) return 0;
  return ((base - value) / base) * 100;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function formatWithPrettier(content, filename) {
  const tmpDir = join(outDir, ".tmp");
  mkdirSync(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, filename);
  writeFileSync(tmpPath, content, "utf8");

  const ensure = spawnSync(process.execPath, [join(root, "scripts", "ensure-deps.js")], {
    cwd: root,
    stdio: "pipe",
  });

  if (ensure.status !== 0) {
    throw new Error(ensure.stderr?.toString() || "ensure-deps failed");
  }

  const fmt = spawnSync(process.execPath, [join(root, "scripts", "format.js"), tmpPath], {
    cwd: root,
    stdio: "pipe",
  });

  if (fmt.status !== 0) {
    throw new Error(fmt.stderr?.toString() || "format failed");
  }

  return readFileSync(tmpPath, "utf8");
}

mkdirSync(outDir, { recursive: true });

const rows = [];
let totalCharsNoSkill = 0;
let totalCharsSkillRaw = 0;
const totalsByTokenizer = new Map(
  tokenizers.map((tokenizer) => [
    tokenizer.label,
    {
      provider: tokenizer.provider,
      label: tokenizer.label,
      note: tokenizer.note,
      tokensNoSkill: 0,
      tokensSkillRaw: 0,
    },
  ])
);

console.log("\n=== compress-code-responses token comparison ===\n");

for (const { name, file } of samples) {
  const fixturePath = join(root, "tests", "fixtures", file);
  const original = readFileSync(fixturePath, "utf8");
  const formattedBaseline = formatWithPrettier(original, file);
  const minified = minifyForSample(original, file);
  const restored = formatWithPrettier(minified, file);

  const f1 = join(outDir, `${name}-1-no-skill-formatted.txt`);
  const f2 = join(outDir, `${name}-2-skill-raw-minified.txt`);
  const f3 = join(outDir, `${name}-3-skill-plus-prettier.txt`);

  writeFileSync(f1, formattedBaseline, "utf8");
  writeFileSync(f2, minified, "utf8");
  writeFileSync(f3, restored, "utf8");

  const charsNoSkill = countChars(formattedBaseline);
  const charsSkillRaw = countChars(minified);
  totalCharsNoSkill += charsNoSkill;
  totalCharsSkillRaw += charsSkillRaw;

  const tokenCounts = tokenizers.map((tokenizer) => {
    const tokensNoSkill = countTokens(tokenizer.encoding, formattedBaseline);
    const tokensSkillRaw = countTokens(tokenizer.encoding, minified);
    const total = totalsByTokenizer.get(tokenizer.label);
    total.tokensNoSkill += tokensNoSkill;
    total.tokensSkillRaw += tokensSkillRaw;

    return {
      provider: tokenizer.provider,
      tokenizer: tokenizer.label,
      tokensNoSkill,
      tokensSkillRaw,
      tokenReductionPct: pctReduction(tokensNoSkill, tokensSkillRaw),
    };
  });

  const row = {
    sample: name,
    charsNoSkill,
    charsSkillRaw,
    charReductionPct: pctReduction(charsNoSkill, charsSkillRaw),
    tokenCounts,
    files: { f1, f2, f3 },
    restoredMatches: equivalentContent(formattedBaseline, restored, file),
  };
  rows.push(row);

  console.log(`--- ${name} ---`);
  console.log(`  characters (no skill): ${charsNoSkill}`);
  console.log(
    `  characters (skill):    ${charsSkillRaw}  (${row.charReductionPct.toFixed(1)}% less)`
  );

  for (const tokenCount of tokenCounts) {
    console.log(
      `  ${tokenCount.provider} ${tokenCount.tokenizer}: ${tokenCount.tokensNoSkill} -> ${tokenCount.tokensSkillRaw} (${tokenCount.tokenReductionPct.toFixed(1)}% less)`
    );
  }

  console.log(`  prettier restores:     ${row.restoredMatches ? "yes" : "NO - check formatter"}`);
  console.log(`  file1 (no skill):      ${f1}`);
  console.log(`  file2 (skill raw):     ${f2}`);
  console.log(`  file3 (skill+prettier):${f3}`);
  console.log("");
}

const tokenizerTotals = [...totalsByTokenizer.values()].map((total) => ({
  ...total,
  tokenReductionPct: pctReduction(total.tokensNoSkill, total.tokensSkillRaw),
}));

const summary = {
  generatedAt: new Date().toISOString(),
  samples: rows,
  totals: {
    charsNoSkill: totalCharsNoSkill,
    charsSkillRaw: totalCharsSkillRaw,
    charReductionPct: pctReduction(totalCharsNoSkill, totalCharsSkillRaw),
    tokenizers: tokenizerTotals,
  },
  notes: [
    "OpenAI token counts are calculated locally with tiktoken.",
    "Character counts are included as a provider-neutral proxy for models without a stable offline tokenizer in this repo.",
  ],
};

writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

const summaryTable = markdownTable(
  ["Measure", "No skill", "Skill raw", "Reduction"],
  [
    [
      "Characters",
      formatNumber(totalCharsNoSkill),
      formatNumber(totalCharsSkillRaw),
      `${summary.totals.charReductionPct.toFixed(1)}%`,
    ],
    ...tokenizerTotals.map((total) => [
      `${total.provider} ${total.label}`,
      formatNumber(total.tokensNoSkill),
      formatNumber(total.tokensSkillRaw),
      `${total.tokenReductionPct.toFixed(1)}%`,
    ]),
  ]
);

const sampleTable = markdownTable(
  ["Sample", "Chars no skill", "Chars skill", "Char reduction", "Restored"],
  rows.map((row) => [
    row.sample,
    formatNumber(row.charsNoSkill),
    formatNumber(row.charsSkillRaw),
    `${row.charReductionPct.toFixed(1)}%`,
    row.restoredMatches ? "yes" : "no",
  ])
);

writeFileSync(
  join(outDir, "summary.md"),
  `# Token comparison summary\n\n${summaryTable}\n\n${sampleTable}\n`,
  "utf8"
);

console.log("=== totals ===");
console.log(`  characters (no skill): ${totalCharsNoSkill}`);
console.log(
  `  characters (skill):    ${totalCharsSkillRaw}  (${summary.totals.charReductionPct.toFixed(1)}% less)`
);

for (const total of tokenizerTotals) {
  console.log(
    `  ${total.provider} ${total.label}: ${total.tokensNoSkill} -> ${total.tokensSkillRaw} (${total.tokenReductionPct.toFixed(1)}% less)`
  );
}

console.log(`  summary:               ${join(outDir, "summary.md")}`);

for (const tokenizer of tokenizers) {
  tokenizer.encoding.free();
}
