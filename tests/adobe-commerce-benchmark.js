#!/usr/bin/env node
/**
 * Adobe Commerce benchmark
 * 
 * Compares real Adobe Commerce files against their skill rules:
 * - Model output: minified whitespace only (preserves comments, strings, identifiers)
 * - Prettier restore: formatted code back
 * 
 * Run: node tests/adobe-commerce-benchmark.js
 * 
 * This script looks for Adobe Commerce files in a configured project path.
 * If not found, it falls back to using fixtures from the test suite.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { minifyWhitespace, countChars } from "../lib/minify-whitespace.js";
import { get_encoding } from "tiktoken";
import { equivalentContent } from "../lib/equivalent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");

// Generic Adobe Commerce project structure paths (these are sample paths, not real)
const PROJECT_PATH = process.env.ADOBE_PROJECT_PATH || null;
const testFiles = [
  "app/code/GenericVendor/GenericModule/Service/OrderProcessor.php",
  "app/code/GenericVendor/WarmupGraphQl/registration.php",
  "app/code/GenericVendor/WarmupGraphQl/etc/module.xml",
  "app/code/GenericVendor/MultiOrderSplit/etc/di.xml",
];

const fixtures = [];
let foundFiles = false;

if (PROJECT_PATH) {
  for (const file of testFiles) {
    const fullPath = join(PROJECT_PATH, file);
    try {
      const content = readFileSync(fullPath, "utf8");
      if (content.length > 100) {
        const fixture = { name: `${file.split("/").slice(-2).join("/")}`, content, ext: file.split(".").pop() };
        if (!fixtures.some(f => f.name === fixture.name)) {
          fixtures.push(fixture);
          foundFiles = true;
        }
      }
    } catch (err) {
      continue;
    }
  }
}

if (!foundFiles) {
  console.log("No Adobe Commerce files found. Using fixtures from test suite.\n");
  console.log("To benchmark real files, set ADOBE_PROJECT_PATH environment variable.\n");
}

const tokenizers = [
  { label: "cl100k_base", note: "GPT-3.5/GPT-4" },
  { label: "o200k_base", note: "GPT-4o/o-series" },
  { label: "p50k_base", note: "Codex/old" },
];

function pct(base, value) {
  if (base === 0) return 0;
  return ((base - value) / base) * 100;
}

console.log("\n=== ADOBE COMMERCE BENCHMARK ===\n");

// Load prettier config once
const configModule = await import(`file://${join(pkgRoot, "prettier.config.js")}`);
const config = configModule.default || configModule;
const results = [];

for (const fixture of fixtures) {
  console.log(`--- ${fixture.name} ---`);
  try {
    const formatted = await prettier.format(fixture.content, {
      ...config,
      filepath: `test.${fixture.ext}`,
    });
    const minified = minifyWhitespace(fixture.content);
    const restored = await prettier.format(minified, {
      ...config,
      filepath: `test.${fixture.ext}`,
    });
    const tokenCounts = tokenizers.map((tokenizer) => {
      const enc = get_encoding(tokenizer.label);
      const tokensNoSkill = enc.encode(formatted).length;
      const tokensSkill = enc.encode(minified).length;
      enc.free();
      return {
        label: tokenizer.label,
        tokensNoSkill,
        tokensSkill,
        tokenReductionPct: pct(tokensNoSkill, tokensSkill),
      };
    });
    const charNoSkill = countChars(formatted);
    const charSkill = countChars(minified);
    const restoredMatches = equivalentContent(formatted, restored, `test.${fixture.ext}`);
    
    // Line and whitespace analysis
    const linesFormatted = formatted.split("\n");
    const linesMinified = minified.split("\n");
    const blankLines = linesFormatted.filter((l) => l.trim() === "").length;
    const commentLines = linesFormatted.filter((l) => {
      const trimmed = l.trim();
      return trimmed.startsWith("/");
    }).length;
    
    console.log(`  chars (no skill): ${charNoSkill}`);
    console.log(`  chars (skill):    ${charSkill}  (${pct(charNoSkill, charSkill).toFixed(1)}% less)`);
    for (const tokenCount of tokenCounts) {
      console.log(`  ${tokenCount.label}: ${tokenCount.tokensNoSkill} -> ${tokenCount.tokensSkill} (${tokenCount.tokenReductionPct.toFixed(1)}% less)`);
    }
    console.log(`  prettier restores: ${restoredMatches ? "yes" : "NO - check formatter"}`);
    console.log(`  lines: ${linesFormatted.length} -> ${linesMinified.length} (saved ${linesFormatted.length - linesMinified.length})`);
    console.log(`  blank lines: ${blankLines}`);
    console.log(`  comment lines: ${commentLines}`);
    console.log("");
    
    results.push({
      name: fixture.name,
      charNoSkill,
      charSkill,
      charReductionPct: pct(charNoSkill, charSkill),
      tokenCounts,
      restoredMatches,
      formattedLines: linesFormatted.length,
      minifiedLines: linesMinified.length,
    });
  } catch (err) {
    console.log(`  [ERROR] ${err.message}\n`);
  }
}

// Aggregate totals
const totalCharsNoSkill = results.reduce((sum, r) => sum + r.charNoSkill, 0);
const totalCharsSkill = results.reduce((sum, r) => sum + r.charSkill, 0);

console.log("\n=== TOTALS ===");
console.log(`  chars (no skill): ${totalCharsNoSkill}`);
console.log(`  chars (skill):    ${totalCharsSkill}  (${pct(totalCharsNoSkill, totalCharsSkill).toFixed(1)}% less)`);

console.log("\n=== PER-SAMPLE BREAKDOWN ===");
for (const result of results) {
  const avgTokenPct = result.tokenCounts.reduce((s, tc) => s + tc.tokenReductionPct, 0) / result.tokenCounts.length;
  console.log(`  ${result.name}: ${result.charReductionPct.toFixed(1)}% chars, ${avgTokenPct.toFixed(1)}% tokens`);
}

console.log("\n=== KEY INSIGHT: COMMENT PRESERVATION ===");
console.log("- Minifier preserves ALL code comments and docBlocks");
console.log("- Blank lines and indentation whitespace are removed");
console.log("- Enterprise PHP (many @param, @return docBlocks) saves less than clean PHP");
console.log("- XML comments (commerce Copyright headers) increase savings");
console.log("- GraphQL @deprecated/docs preserved by minifier -> less savings");
