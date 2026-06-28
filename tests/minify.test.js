import test from "node:test";
import assert from "node:assert/strict";
import { minifyWhitespace, countChars } from "../lib/minify-whitespace.js";

test("minifyWhitespace reduces characters", () => {
  const input = `function a() {
  const x = 1;

  return x;
}
`;
  const out = minifyWhitespace(input);
  assert.ok(countChars(out) < countChars(input));
  assert.match(out, /function a\(\)/);
  assert.match(out, /return x/);
});

test("minifyWhitespace preserves identifiers", () => {
  const input = "const myLongVariableName = 42;\n";
  const out = minifyWhitespace(input);
  assert.match(out, /myLongVariableName/);
});
