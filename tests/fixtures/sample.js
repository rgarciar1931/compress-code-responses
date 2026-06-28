function calculateOrderTotal(items) {
  let subtotal = 0;

  for (const item of items) {
    const lineTotal = item.price * item.quantity;
    subtotal += lineTotal;
  }

  const taxRate = 0.0825;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal: roundCurrency(subtotal),
    tax: roundCurrency(tax),
    total: roundCurrency(total),
  };
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { calculateOrderTotal, roundCurrency };
