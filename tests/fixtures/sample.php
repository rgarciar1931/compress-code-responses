<?php

declare(strict_types=1);

namespace App\Service;

final class InvoiceCalculator
{
  public function compute(array $lines, float $taxRate): array
  {
    $subtotal = 0.0;

    foreach ($lines as $line) {
      $quantity = (int) ($line["quantity"] ?? 0);
      $unitPrice = (float) ($line["unit_price"] ?? 0.0);
      $subtotal += $quantity * $unitPrice;
    }

    $tax = $subtotal * $taxRate;

    return [
      "subtotal" => round($subtotal, 2),
      "tax" => round($tax, 2),
      "total" => round($subtotal + $tax, 2),
    ];
  }
}
