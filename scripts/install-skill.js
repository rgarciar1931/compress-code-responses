#!/usr/bin/env node
/**
 * Install compress-code-responses skill into user-level and project-level paths.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = join(root, "skills", "compress-code-responses", "SKILL.md");
const skillBody = readFileSync(skillSource, "utf8");

const projectTargets = [
  join(root, ".cursor", "skills", "compress-code-responses", "SKILL.md"),
  join(root, ".claude", "skills", "compress-code-responses", "SKILL.md"),
  join(root, ".agents", "skills", "compress-code-responses", "SKILL.md"),
  join(root, ".opencode", "skills", "compress-code-responses", "SKILL.md"),
];

const home = homedir();
const globalTargets = [
  join(home, ".cursor", "skills", "compress-code-responses", "SKILL.md"),
  join(home, ".claude", "skills", "compress-code-responses", "SKILL.md"),
  join(home, ".agents", "skills", "compress-code-responses", "SKILL.md"),
  join(home, ".config", "opencode", "skills", "compress-code-responses", "SKILL.md"),
  join(home, ".copilot", "copilot-instructions.d", "compress-code-responses.md"),
];

function writeSkill(targetPath) {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, skillBody, "utf8");
  console.log(`  ✓ ${targetPath}`);
}

function writeCopilotInstructions() {
  const copilotRepo = join(root, ".github", "copilot-instructions.md");
  const snippet = readFileSync(join(root, "platform", "copilot-instructions.snippet.md"), "utf8");
  mkdirSync(dirname(copilotRepo), { recursive: true });
  writeFileSync(copilotRepo, snippet, "utf8");
  console.log(`  ✓ ${copilotRepo}`);

  const instructionsDir = join(root, ".github", "instructions");
  mkdirSync(instructionsDir, { recursive: true });
  const pathSpecific = readFileSync(
    join(root, "platform", "compress-code-responses.instructions.md"),
    "utf8"
  );
  writeFileSync(join(instructionsDir, "compress-code-responses.instructions.md"), pathSpecific, "utf8");
  console.log(`  ✓ ${join(instructionsDir, "compress-code-responses.instructions.md")}`);
}

function copyPhpStormHint() {
  const dest = join(root, "platform", "phpstorm", "README.md");
  if (existsSync(dest)) {
    console.log(`  ✓ PHPStorm notes at ${dest}`);
  }
}

console.log("Installing project skill copies...");
for (const t of projectTargets) writeSkill(t);

console.log("\nInstalling global skill copies (optional for all repos)...");
for (const t of globalTargets) {
  try {
    writeSkill(t);
  } catch (err) {
    console.warn(`  ⚠ Skipped ${t}: ${err.message}`);
  }
}

console.log("\nWriting GitHub Copilot instruction files...");
writeCopilotInstructions();
copyPhpStormHint();

console.log("\nDone. Run `npm run ensure-deps` before first format.");
