import { describe, expect, it } from "vitest";

import {
  closeOutPrice,
  createPlanPrice,
  isPlanSellableAtTier,
  planPriceAmount,
  resolveCurrentPriceForTier,
} from "./plan-price";

const PLAN_ID = "plan-1";
const TIER_A = "tier-a";
const TIER_B = "tier-b";

// CAT: Per-Tier Absolute Pricing.
describe("resolveCurrentPriceForTier", () => {
  it("resolves different absolute amounts for the same plan at two tiers", () => {
    const priceA = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_A,
      amountMinor: 10_000,
      currency: "COP",
    });
    const priceB = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_B,
      amountMinor: 15_000,
      currency: "COP",
    });

    expect(resolveCurrentPriceForTier([priceA, priceB], TIER_A)?.amountMinor).toBe(10_000);
    expect(resolveCurrentPriceForTier([priceA, priceB], TIER_B)?.amountMinor).toBe(15_000);
  });

  // CAT: Missing Tier Price Blocks Sale.
  it("does not fall back to another tier's price when the requested tier has none", () => {
    const priceA = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_A,
      amountMinor: 10_000,
      currency: "COP",
    });

    expect(resolveCurrentPriceForTier([priceA], TIER_B)).toBeNull();
  });

  it("ignores a closed-out (non-current) row for the requested tier", () => {
    const closed = closeOutPrice(
      createPlanPrice({ planId: PLAN_ID, priceTierId: TIER_A, amountMinor: 5_000, currency: "COP" }),
    );

    expect(resolveCurrentPriceForTier([closed], TIER_A)).toBeNull();
  });
});

describe("isPlanSellableAtTier", () => {
  it("is not sellable at a tier with no current price row, with no fallback", () => {
    const priceA = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_A,
      amountMinor: 10_000,
      currency: "COP",
    });

    expect(isPlanSellableAtTier([priceA], TIER_B)).toBe(false);
  });

  it("is sellable at a tier that has a current price row", () => {
    const priceB = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_B,
      amountMinor: 12_000,
      currency: "COP",
    });

    expect(isPlanSellableAtTier([priceB], TIER_B)).toBe(true);
  });
});

// CAT: Price History Is Preserved.
describe("closeOutPrice", () => {
  it("keeps the prior price row's identity while marking it no longer current", () => {
    const price = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_A,
      amountMinor: 7_000,
      currency: "COP",
    });

    const closed = closeOutPrice(price);

    expect(closed.id).toBe(price.id);
    expect(closed.amountMinor).toBe(price.amountMinor);
    expect(closed.effectiveTo).not.toBeNull();
  });
});

describe("planPriceAmount", () => {
  it("returns a Money value matching the stored amount and currency", () => {
    const price = createPlanPrice({
      planId: PLAN_ID,
      priceTierId: TIER_A,
      amountMinor: 9_000,
      currency: "COP",
    });

    expect(planPriceAmount(price)).toEqual({ amountMinor: 9_000, currency: "COP" });
  });
});
