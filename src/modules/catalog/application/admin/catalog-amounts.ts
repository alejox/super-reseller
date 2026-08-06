import type { CurrencyCode } from "@/shared/money/money";

/**
 * Form input parsing shared by the plan use cases.
 *
 * These take STRINGS because that is what a form submits. Parsing here rather
 * than at the action boundary keeps every rule — and every rejection message —
 * in one place the tests can reach without a browser.
 */

/**
 * The only currency this product mints (design.md). Kept as a named constant
 * rather than scattered `"COP"` literals so the day a second currency arrives,
 * the compiler shows every site that assumed one.
 */
export const CATALOG_CURRENCY: CurrencyCode = "COP";

/**
 * `Number()` on its own is too permissive for this: it maps "", " ", "0x10"
 * and "1e3" to numbers, so an empty field would arrive as 0 — a free plan
 * nobody asked for. The explicit digit pattern is what makes "" a rejection
 * instead of a silent zero.
 */
function parseNonNegativeInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/** A money amount in minor units: zero is legal, negatives and decimals are not. */
export function parseAmountMinor(raw: string): number | null {
  return parseNonNegativeInteger(raw);
}

/** A duration in whole days: `plan_duration_days_check` requires > 0. */
export function parseDurationDays(raw: string): number | null {
  const value = parseNonNegativeInteger(raw);
  return value === null || value === 0 ? null : value;
}
