/**
 * All money math happens in integer cents (bigint), never JS floating
 * point — `numeric(12,2)` columns are read/written as decimal strings, and
 * this module is the only place that converts between the two. Assumes
 * non-negative amounts, which is the only case this domain has (prices,
 * subtotals, commissions are never negative).
 *
 * Rounding rule: round-half-up to the nearest cent (standard commercial
 * rounding), applied once per computed value — e.g. commission is rounded
 * once from `subtotal * rate`, not accumulated from per-line-item roundings.
 * This is deterministic and reproducible given the same inputs.
 */

export function parseMoneyToCents(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, fractionPart = ''] = unsigned.split('.');

  if (fractionPart.length > 2) {
    throw new Error(`Money value "${value}" has more than 2 decimal places`);
  }
  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fractionPart)) {
    throw new Error(`Money value "${value}" is not a valid decimal number`);
  }

  const paddedFraction = fractionPart.padEnd(2, '0');
  const cents = BigInt(wholePart || '0') * 100n + BigInt(paddedFraction || '0');
  return negative ? -cents : cents;
}

export function formatCentsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`;
}

export function sumCents(values: bigint[]): bigint {
  return values.reduce((acc, v) => acc + v, 0n);
}

export function multiplyCentsByQuantity(
  unitPriceCents: bigint,
  quantity: number,
): bigint {
  return unitPriceCents * BigInt(quantity);
}

/** `percent` is a decimal string like "10.00" meaning 10%. */
export function applyPercent(cents: bigint, percent: string): bigint {
  const percentHundredths = parseMoneyToCents(percent); // "10.00" -> 1000n (percent * 100)
  const numerator = cents * percentHundredths;
  const denominator = 10_000n; // undo the *100 from cents and the *100 from percentHundredths
  return roundHalfUpDivide(numerator, denominator);
}

/**
 * `amountCents * numeratorCents / denominatorCents`, round-half-up. Used to
 * carry a stored ratio (e.g. a SellerOrder's already-computed
 * commission/subtotal split) forward onto a partial amount — a partial
 * refund's commission correction is computed this way rather than
 * re-applying the seller's *current* commission rate, so refund math still
 * reconciles exactly even if the seller's rate changed since the sale.
 * `denominatorCents === 0n` returns 0n rather than dividing by zero.
 */
export function applyRatio(
  amountCents: bigint,
  numeratorCents: bigint,
  denominatorCents: bigint,
): bigint {
  if (denominatorCents === 0n) return 0n;
  return roundHalfUpDivide(amountCents * numeratorCents, denominatorCents);
}

function roundHalfUpDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}
