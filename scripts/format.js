#!/usr/bin/env node
/**
 * Format files with project Prettier config.
 * Usage: node scripts/format.js [--check] [file...]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args[0] === "--check";
const paths = check ? args.slice(1) : args;

if (paths.length === 0) {
  console.error("Usage: npm run format -- [--check] <file...>");
  process.exit(1);
}

const prettierBin = join(root, "node_modules", "prettier", "bin", "prettier.cjs");
if (!existsSync(prettierBin)) {
  const ensure = join(root, "scripts", "ensure-deps.js");
  const boot = spawnSync(process.execPath, [ensure], { cwd: root, stdio: "inherit" });
  if (boot.status !== 0) process.exit(boot.status ?? 1);
}

const configPath = join(root, "prettier.config.js");
const configModule = await import(pathToFileURL(configPath).href);
const config = configModule.default ?? configModule;

const prettier = await import("prettier");

let failed = false;

for (const filePath of paths) {
  const source = readFileSync(filePath, "utf8");
  let formatted;

  try {
    formatted = await prettier.format(source, {
      ...config,
      filepath: filePath,
    });
  } catch (error) {
    console.error(`${filePath}: ${error.message}`);
    failed = true;
    continue;
  }

  if (check) {
    if (source !== formatted) {
      console.error(`${filePath}: formatting differs`);
      failed = true;
    }
    continue;
  }

  if (source !== formatted) {
    writeFileSync(filePath, formatted, "utf8");
    console.log(`${filePath}`);
  }
}

process.exit(failed ? 1 : 0);
