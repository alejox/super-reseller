import { describe, expect, it, vi } from "vitest";

import { placeOrderAsCustomer } from "./place-customer-order";

const TENANT = "customer-tenant-1";
const USER = "customer-user-1";
const PLAN = "plan-1";
const PROVIDER_ACCOUNT = "provider-account-1";

function deps(overrides: Partial<Parameters<typeof placeOrderAsCustomer>[0]> = {}) {
  return {
    ordering: {
      placeCustomerOrder: vi.fn().mockResolvedValue({ id: "order-1" }),
    },
    resolveSellablePlan: vi.fn().mockResolvedValue({ planPriceId: "price-1" }),
    findOwnProviderAccount: vi.fn().mockResolvedValue({ id: PROVIDER_ACCOUNT }),
    resellerId: TENANT,
    placedBy: USER,
    ...overrides,
  };
}

describe("placeOrderAsCustomer", () => {
  // CP: Price Resolves From The Catalog At Purchase Time — there is no price
  // field in the input type at all, so a caller cannot submit one; this test
  // proves the command sent to the repository carries only the SERVER-
  // resolved plan_price_id.
  it("resolves the price server-side and never carries a client-supplied amount", async () => {
    const d = deps();

    const result = await placeOrderAsCustomer(d, { planId: PLAN, providerAccountId: PROVIDER_ACCOUNT });

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(d.ordering.placeCustomerOrder).toHaveBeenCalledWith({
      resellerId: TENANT,
      placedBy: USER,
      planId: PLAN,
      planPriceId: "price-1",
      providerAccountId: PROVIDER_ACCOUNT,
    });
  });

  // CP: A Customer Starts Their Own Purchase — negative half.
  it("refuses a purchase against a provider account the caller does not own", async () => {
    const d = deps({ findOwnProviderAccount: vi.fn().mockResolvedValue(null) });

    const result = await placeOrderAsCustomer(d, { planId: PLAN, providerAccountId: PROVIDER_ACCOUNT });

    expect(result).toEqual({ ok: false, reason: "provider-account-not-owned" });
    expect(d.resolveSellablePlan).not.toHaveBeenCalled();
    expect(d.ordering.placeCustomerOrder).not.toHaveBeenCalled();
  });

  // CP: Price Resolves From The Catalog At Purchase Time — unpriced duration.
  it("refuses a plan with no current price at this customer's tier", async () => {
    const d = deps({ resolveSellablePlan: vi.fn().mockResolvedValue(null) });

    const result = await placeOrderAsCustomer(d, { planId: PLAN, providerAccountId: PROVIDER_ACCOUNT });

    expect(result).toEqual({ ok: false, reason: "plan-unavailable" });
    expect(d.ordering.placeCustomerOrder).not.toHaveBeenCalled();
  });

  it("refuses an empty plan id without touching the catalog or the account", async () => {
    const d = deps();

    const result = await placeOrderAsCustomer(d, { planId: "  ", providerAccountId: PROVIDER_ACCOUNT });

    expect(result).toEqual({ ok: false, reason: "plan-required" });
    expect(d.findOwnProviderAccount).not.toHaveBeenCalled();
    expect(d.resolveSellablePlan).not.toHaveBeenCalled();
  });

  it("refuses an empty provider account id", async () => {
    const d = deps();

    const result = await placeOrderAsCustomer(d, { planId: PLAN, providerAccountId: " " });

    expect(result).toEqual({ ok: false, reason: "provider-account-required" });
    expect(d.findOwnProviderAccount).not.toHaveBeenCalled();
  });
});
