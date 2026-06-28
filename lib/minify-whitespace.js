/**
 * Conservative whitespace minifier for tests and benchmarks.
 * Mirrors the skill: compress layout, preserve identifiers and strings.
 */
export function minifyWhitespace(source) {
  const lines = source.split(/\r?\n/);
  const nonEmpty = lines
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => {
      if (line.trim() !== "") return true;
      const prev = arr[index - 1];
      const next = arr[index + 1];
      return prev?.trim() !== "" && next?.trim() !== "";
    });

  const joined = nonEmpty.join("\n");
  return joined
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([{}();,\[\]])\s*/g, "$1")
    .replace(/;\s*/g, ";")
    .trim();
}

export function countChars(text) {
  return text.length;
}
