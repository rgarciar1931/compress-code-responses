import test from "node:test";
import assert from "node:assert/strict";
import { equivalentContent, normalizeCodeLines } from "../lib/equivalent.js";

test("equivalentContent treats JSON layout differences as equal", () => {
  const a = '{\n  "a": 1,\n  "b": 2\n}\n';
  const b = '{"a":1,"b":2}';
  assert.equal(equivalentContent(a, b, "sample.json"), true);
});

test("equivalentContent ignores blank-line differences in code", () => {
  const a = "function a() {\n\n  return 1;\n}\n";
  const b = "function a() {\n  return 1;\n}\n";
  assert.equal(equivalentContent(a, b, "sample.js"), true);
  assert.equal(normalizeCodeLines(a), normalizeCodeLines(b));
});
