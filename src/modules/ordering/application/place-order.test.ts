import { describe, expect, it, vi } from "vitest";

import { placeOrderAsReseller } from "./place-order";

const RESELLER = "reseller-1";
const USER = "user-1";
const PLAN = "plan-1";

const sellable = { planPriceId: "price-1", amountMinor: 15_000, currency: "COP" };

function deps(overrides: Partial<Parameters<typeof placeOrderAsReseller>[0]> = {}) {
  return {
    ordering: {
      placeOrder: vi.fn().mockResolvedValue({
        ok: true,
        order: { id: "order-1" },
      }),
    },
    resolveSellablePlan: vi.fn().mockResolvedValue(sellable),
    resellerId: RESELLER,
    placedBy: USER,
    ...overrides,
  };
}

describe("placeOrderAsReseller", () => {
  it("buys at the price resolved from the catalog, not one supplied by the caller", async () => {
    const d = deps();

    const result = await placeOrderAsReseller(d, { planId: PLAN });

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    // The command carries the resolved price and its anchor. A price coming
    // from the request would be a number the buyer chose.
    expect(d.ordering.placeOrder).toHaveBeenCalledWith({
      resellerId: RESELLER,
      placedBy: USER,
      planId: PLAN,
      planPriceId: "price-1",
      amountMinor: 15_000,
      currency: "COP",
    });
  });

  it("refuses a plan that is not sellable at this reseller's tier", async () => {
    const d = deps({ resolveSellablePlan: vi.fn().mockResolvedValue(null) });

    const result = await placeOrderAsReseller(d, { planId: PLAN });

    // Resolving through the scoped catalog IS the authorization check: a
    // plan with no current price at this tier is unreachable, so this also
    // covers a reseller submitting some other tier's plan id.
    expect(result).toEqual({ ok: false, reason: "plan-unavailable" });
    expect(d.ordering.placeOrder).not.toHaveBeenCalled();
  });

  it("refuses an empty plan id without touching the catalog", async () => {
    const d = deps();

    const result = await placeOrderAsReseller(d, { planId: "  " });

    expect(result).toEqual({ ok: false, reason: "plan-required" });
    expect(d.resolveSellablePlan).not.toHaveBeenCalled();
  });

  it("reports insufficient funds with both numbers the buyer needs", async () => {
    const d = deps({
      ordering: {
        placeOrder: vi
          .fn()
          .mockResolvedValue({ ok: false, reason: "insufficient-funds", balanceMinor: 9_000 }),
      },
    });

    const result = await placeOrderAsReseller(d, { planId: PLAN });

    // "You cannot afford this" is useless without saying by how much.
    expect(result).toEqual({
      ok: false,
      reason: "insufficient-funds",
      balanceMinor: 9_000,
      priceMinor: 15_000,
    });
  });
});
