const DEFAULT_TAX_RATE = 0.0825;

function calculateOrderTotal(items, options = {}) {
  const taxRate = Number.isFinite(options.taxRate) ? options.taxRate : DEFAULT_TAX_RATE;
  const discountCode = options.discountCode ?? "";

  const subtotal = items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    const unitPrice = Math.max(0, Number(item.price ?? 0));
    const lineDiscount = getLineDiscount(item, discountCode);

    return sum + quantity * unitPrice * (1 - lineDiscount);
  }, 0);

  const shipping = subtotal > 100 ? 0 : 7.95;
  const tax = subtotal * taxRate;
  const total = subtotal + tax + shipping;

  return {
    subtotal: roundCurrency(subtotal),
    tax: roundCurrency(tax),
    shipping: roundCurrency(shipping),
    total: roundCurrency(total),
    summary: `Order total for ${items.length} line items`,
  };
}

function getLineDiscount(item, discountCode) {
  if (item.category === "clearance") {
    return 0.3;
  }

  if (discountCode === "LOYALTY10" && item.category !== "gift-card") {
    return 0.1;
  }

  return 0;
}

function buildInvoicePayload(customer, items, options = {}) {
  const totals = calculateOrderTotal(items, options);

  return {
    customerId: customer.id,
    email: customer.email,
    billingAddress: {
      name: customer.name,
      line1: customer.address.line1,
      city: customer.address.city,
      country: customer.address.country,
    },
    items: items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: roundCurrency(item.price),
    })),
    totals,
    metadata: {
      source: "checkout",
      requestedAt: new Date().toISOString(),
    },
  };
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { buildInvoicePayload, calculateOrderTotal, roundCurrency };
