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

  return normalizeCodeLines(a) === normalizeCodeLines(b);
}
