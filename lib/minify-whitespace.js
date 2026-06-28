/**
 * Conservative whitespace minifier for tests and benchmarks.
 * Mirrors the skill: compress layout, preserve identifiers, strings, and comments.
 */
export function minifyWhitespace(source) {
  let output = "";
  let pendingSpace = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (/\s/.test(char)) {
      pendingSpace = output.length > 0;
      continue;
    }

    if ((char === "/" && next === "/") || char === "#") {
      const end = source.indexOf("\n", index);
      const comment = source.slice(index, end === -1 ? source.length : end).trimEnd();
      output = emit(output, comment, pendingSpace);
      output = output.replace(/[ \t]*$/, "");
      output += "\n";
      pendingSpace = false;
      index = end === -1 ? source.length : end;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const comment = source.slice(index, end === -1 ? source.length : end + 2);
      output = emit(output, comment, pendingSpace);
      pendingSpace = false;
      index = end === -1 ? source.length : end + 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const quoted = readQuoted(source, index, char);
      output = emit(output, quoted.value, pendingSpace);
      pendingSpace = false;
      index = quoted.end;
      continue;
    }

    output = emit(output, char, pendingSpace);
    pendingSpace = false;
  }

  return output.replace(/\n{2,}/g, "\n").trim();
}

export function countChars(text) {
  return text.length;
}

function readQuoted(source, start, quote) {
  let value = quote;
  let escaped = false;

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    value += char;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === quote) {
      return { value, end: index };
    }
  }

  return { value, end: source.length - 1 };
}

function emit(output, value, pendingSpace) {
  const next = value[0] ?? "";
  const compacted = shouldTrimBefore(next) ? output.replace(/[ \t]+$/, "") : output;
  const prev = compacted.at(-1) ?? "";
  const separator = pendingSpace && needsSeparator(prev, next) ? " " : "";
  return `${compacted}${separator}${value}`;
}

function needsSeparator(prev, next) {
  if (!prev || !next || prev === "\n") return false;
  if (isWordChar(prev) && next === "\\") return true;
  return isWordChar(prev) && isWordChar(next);
}

function isWordChar(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function shouldTrimBefore(char) {
  return /[{}()[\];,.:=>+\-*/%&|!?]/.test(char);
}
