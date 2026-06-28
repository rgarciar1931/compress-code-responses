import test from "node:test";
import assert from "node:assert/strict";
import { minifyWhitespace, countChars } from "../lib/minify-whitespace.js";

test("minifyWhitespace reduces characters without renaming identifiers", () => {
  const input = `function calculateOrderTotal(lineItems) {
  const taxRate = 0.0825;
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  return {
    subtotal,
    tax: subtotal * taxRate,
  };
}
`;
  const out = minifyWhitespace(input);
  assert.ok(countChars(out) < countChars(input));
  assert.match(out, /calculateOrderTotal/);
  assert.match(out, /lineItems/);
});

test("minifyWhitespace preserves identifiers", () => {
  const input = "const myLongVariableName = 42;\n";
  const out = minifyWhitespace(input);
  assert.match(out, /myLongVariableName/);
});

test("minifyWhitespace preserves string spacing and comments", () => {
  const input = `// Keep this comment
const label = "Pending   Approval";
const message = \`Order \${label} requires review\`;
`;
  const out = minifyWhitespace(input);
  assert.match(out, /\/\/ Keep this comment/);
  assert.match(out, /"Pending   Approval"/);
  assert.match(out, /`Order \${label} requires review`/);
});
