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
const encoding = get_encoding("cl100k_base");

const samples = [
  { name: "javascript", file: "sample.js" },
  { name: "php", file: "sample.php" },
  { name: "json", file: "sample.json" },
];

function countTokens(text) {
  return encoding.encode(text).length;
}

function pctDiff(base, value) {
  if (base === 0) return 0;
  return ((value - base) / base) * 100;
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

  const fmt = spawnSync(
    process.execPath,
    [join(root, "scripts", "format.js"), tmpPath],
    { cwd: root, stdio: "pipe" }
  );
  if (fmt.status !== 0) {
    throw new Error(fmt.stderr?.toString() || "format failed");
  }

  return readFileSync(tmpPath, "utf8");
}

mkdirSync(outDir, { recursive: true });

const rows = [];
let totalTokensNoSkill = 0;
let totalTokensSkillRaw = 0;
let totalCharsNoSkill = 0;
let totalCharsSkillRaw = 0;

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

  const tokensNoSkill = countTokens(formattedBaseline);
  const tokensSkillRaw = countTokens(minified);
  const charsNoSkill = countChars(formattedBaseline);
  const charsSkillRaw = countChars(minified);

  totalTokensNoSkill += tokensNoSkill;
  totalTokensSkillRaw += tokensSkillRaw;
  totalCharsNoSkill += charsNoSkill;
  totalCharsSkillRaw += charsSkillRaw;

  const row = {
    sample: name,
    tokensNoSkill,
    tokensSkillRaw,
    tokenPct: pctDiff(tokensNoSkill, tokensSkillRaw),
    charsNoSkill,
    charsSkillRaw,
    charPct: pctDiff(charsNoSkill, charsSkillRaw),
    files: { f1, f2, f3 },
    restoredMatches: equivalentContent(formattedBaseline, restored, file),
  };
  rows.push(row);

  console.log(`--- ${name} ---`);
  console.log(`  tokens (no skill):     ${tokensNoSkill}`);
  console.log(`  tokens (skill raw):    ${tokensSkillRaw}  (${row.tokenPct.toFixed(1)}%)`);
  console.log(`  characters (no skill): ${charsNoSkill}`);
  console.log(`  characters (skill):    ${charsSkillRaw}  (${row.charPct.toFixed(1)}%)`);
  console.log(`  prettier restores:     ${row.restoredMatches ? "yes" : "NO — check formatter"}`);
  console.log(`  file1 (no skill):      ${f1}`);
  console.log(`  file2 (skill raw):     ${f2}`);
  console.log(`  file3 (skill+prettier):${f3}`);
  console.log("");
}

console.log("=== totals ===");
console.log(`  tokens (no skill):     ${totalTokensNoSkill}`);
console.log(`  tokens (skill raw):    ${totalTokensSkillRaw}  (${pctDiff(totalTokensNoSkill, totalTokensSkillRaw).toFixed(1)}%)`);
console.log(`  characters (no skill): ${totalCharsNoSkill}`);
console.log(`  characters (skill):    ${totalCharsSkillRaw}  (${pctDiff(totalCharsNoSkill, totalCharsSkillRaw).toFixed(1)}%)`);

encoding.free();
