import { beforeEach, describe, expect, it, vi } from "vitest";

import { mintCustomerScope } from "@/modules/identity/domain/access-scope";
import { placeOrderForCustomer } from "./place-order-for-customer";

const ADMIN = "99999999-1111-4111-8111-111111111111";
const CUSTOMER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TIER = "99999999-9999-4999-8999-999999999999";
const PLAN = "plan-1";
const PROVIDER_ACCOUNT = "provider-account-1";

const requireRole = vi.fn();
const actAsCustomer = vi.fn();

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
  actAsCustomer: (...args: unknown[]) => actAsCustomer(...args),
}));

function deps() {
  return {
    ordering: { placeCustomerOrder: vi.fn().mockResolvedValue({ id: "order-1" }) },
    resolveSellablePlan: vi.fn().mockResolvedValue({ planPriceId: "price-1" }),
    findOwnProviderAccount: vi.fn().mockResolvedValue({ id: PROVIDER_ACCOUNT }),
  };
}

beforeEach(() => {
  requireRole.mockReset();
  actAsCustomer.mockReset();
});

// CP: ADMIN May Start A Purchase On A Customer's Behalf.
describe("placeOrderForCustomer", () => {
  it("records the order under the target customer's tenant id, placed by the acting admin", async () => {
    requireRole.mockResolvedValue({ role: "ADMIN", userId: ADMIN });
    actAsCustomer.mockResolvedValue(mintCustomerScope(CUSTOMER, CUSTOMER, TIER, ADMIN));
    const d = deps();

    const result = await placeOrderForCustomer(d, CUSTOMER, {
      planId: PLAN,
      providerAccountId: PROVIDER_ACCOUNT,
    });

    expect(requireRole).toHaveBeenCalledWith("ADMIN");
    expect(actAsCustomer).toHaveBeenCalledWith(CUSTOMER);
    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(d.ordering.placeCustomerOrder).toHaveBeenCalledWith(
      expect.objectContaining({ resellerId: CUSTOMER, placedBy: ADMIN }),
    );
  });

  // CP: Reseller cannot start a purchase for a customer.
  it("propagates a rejection from requireRole('ADMIN') without ever calling actAsCustomer", async () => {
    const denied = new Error("Forbidden");
    requireRole.mockRejectedValue(denied);
    const d = deps();

    await expect(
      placeOrderForCustomer(d, CUSTOMER, { planId: PLAN, providerAccountId: PROVIDER_ACCOUNT }),
    ).rejects.toThrow(denied);
    expect(actAsCustomer).not.toHaveBeenCalled();
    expect(d.ordering.placeCustomerOrder).not.toHaveBeenCalled();
  });

  it("propagates a rejection from actAsCustomer (target not a CUSTOMER, or deactivated) without writing anything", async () => {
    requireRole.mockResolvedValue({ role: "ADMIN", userId: ADMIN });
    const denied = new Error("Forbidden");
    actAsCustomer.mockRejectedValue(denied);
    const d = deps();

    await expect(
      placeOrderForCustomer(d, CUSTOMER, { planId: PLAN, providerAccountId: PROVIDER_ACCOUNT }),
    ).rejects.toThrow(denied);
    expect(d.ordering.placeCustomerOrder).not.toHaveBeenCalled();
  });
});
