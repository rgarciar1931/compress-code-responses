<?php

declare(strict_types=1);

namespace App\Service;

final class InvoiceCalculator
{
  public function compute(array $lines, float $taxRate, array $options = []): array
  {
    $subtotal = 0.0;
    $discountCode = (string) ($options["discount_code"] ?? "");

    foreach ($lines as $line) {
      $quantity = (int) ($line["quantity"] ?? 0);
      $unitPrice = (float) ($line["unit_price"] ?? 0.0);
      $discount = $this->resolveDiscount($line, $discountCode);

      $subtotal += $quantity * $unitPrice * (1.0 - $discount);
    }

    $shipping = $subtotal > 100.0 ? 0.0 : 7.95;
    $tax = $subtotal * $taxRate;

    return [
      "subtotal" => round($subtotal, 2),
      "tax" => round($tax, 2),
      "shipping" => round($shipping, 2),
      "total" => round($subtotal + $tax + $shipping, 2),
      "summary" => sprintf("Invoice total for %d line items", count($lines)),
    ];
  }

  public function buildPayload(array $customer, array $lines, array $options = []): array
  {
    $totals = $this->compute($lines, (float) ($options["tax_rate"] ?? 0.0825), $options);

    return [
      "customer_id" => (string) $customer["id"],
      "email" => (string) $customer["email"],
      "billing_address" => [
        "name" => (string) $customer["name"],
        "line1" => (string) $customer["address"]["line1"],
        "city" => (string) $customer["address"]["city"],
        "country" => (string) $customer["address"]["country"],
      ],
      "lines" => array_map(
        static fn(array $line): array => [
          "sku" => (string) $line["sku"],
          "name" => (string) $line["name"],
          "quantity" => (int) $line["quantity"],
          "unit_price" => round((float) $line["unit_price"], 2),
        ],
        $lines
      ),
      "totals" => $totals,
      "metadata" => [
        "source" => "checkout",
        "requested_at" => (new \DateTimeImmutable())->format(DATE_ATOM),
      ],
    ];
  }

  private function resolveDiscount(array $line, string $discountCode): float
  {
    if (($line["category"] ?? "") === "clearance") {
      return 0.3;
    }

    if ($discountCode === "LOYALTY10" && ($line["category"] ?? "") !== "gift-card") {
      return 0.1;
    }

    return 0.0;
  }
}
