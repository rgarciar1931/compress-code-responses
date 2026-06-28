import { minifyWhitespace } from "./minify-whitespace.js";

export function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

export function normalizeCodeLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .join("\n");
}

export function equivalentContent(a, b, file) {
  if (file.endsWith(".json")) {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  }

  return normalizeComparableCode(a) === normalizeComparableCode(b);
}

function normalizeComparableCode(text) {
  return minifyWhitespace(text).replace(/,([}\]])/g, "$1");
}
