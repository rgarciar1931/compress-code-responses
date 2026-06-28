#!/usr/bin/env node
/**
 * Idempotent dependency check. Installs npm packages on first run.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prettierBin = join(root, "node_modules", "prettier", "bin", "prettier.cjs");

if (existsSync(prettierBin)) {
  process.exit(0);
}

console.log("[compress-code-responses] Installing Prettier and plugins...");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["install", "--no-fund", "--no-audit"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
