import { type CurrencyCode, type Money, money } from "@/shared/money/money";

import type { PlanId, PlanPriceId, PriceTierId } from "./ids";

/**
 * Append-only, individually addressable (design.md: "Decision: `plan_price`
 * is append-only and individually addressable"). `id` is the order-time
 * anchor a future order line will store as a foreign key — never mutate an
 * existing row's `amountMinor`/`currency`; close it out and insert a new
 * one instead.
 */
export type PlanPrice = Readonly<{
  id: PlanPriceId;
  planId: PlanId;
  priceTierId: PriceTierId;
  amountMinor: number;
  currency: CurrencyCode;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}>;

export type NewPlanPriceInput = Readonly<{
  planId: PlanId;
  priceTierId: PriceTierId;
  amountMinor: number;
  currency: CurrencyCode;
  effectiveFrom?: Date;
}>;

export function createPlanPrice(input: NewPlanPriceInput): PlanPrice {
  // Reuses shared/money's guard — throws InvalidMoneyError on a non-integer
  // amount or a malformed currency code (EB: Money Is Integer Minor Units
  // With Currency).
  money(input.amountMinor, input.currency);

  return Object.freeze({
    id: crypto.randomUUID(),
    planId: input.planId,
    priceTierId: input.priceTierId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    effectiveFrom: input.effectiveFrom ?? new Date(),
    effectiveTo: null,
  });
}

export function planPriceAmount(price: PlanPrice): Money {
  return money(price.amountMinor, price.currency);
}

export function isCurrentPrice(price: PlanPrice): boolean {
  return price.effectiveTo === null;
}

/**
 * CAT: Missing Tier Price Blocks Sale. Picks the current row for the exact
 * tier requested only — there is no code path that reaches for a different
 * tier's row, so a silent fallback is not representable here.
 */
export function resolveCurrentPriceForTier(
  prices: readonly PlanPrice[],
  tierId: PriceTierId,
): PlanPrice | null {
  return prices.find((price) => price.priceTierId === tierId && isCurrentPrice(price)) ?? null;
}

export function isPlanSellableAtTier(prices: readonly PlanPrice[], tierId: PriceTierId): boolean {
  return resolveCurrentPriceForTier(prices, tierId) !== null;
}

/**
 * CAT: Price History Is Preserved. Returns a NEW object with `effectiveTo`
 * set — the original row's data (including its `id`) is preserved, never
 * mutated in place, so a caller holding the old reference still sees the
 * original amount.
 */
export function closeOutPrice(price: PlanPrice, closedAt: Date = new Date()): PlanPrice {
  return Object.freeze({ ...price, effectiveTo: closedAt });
}
