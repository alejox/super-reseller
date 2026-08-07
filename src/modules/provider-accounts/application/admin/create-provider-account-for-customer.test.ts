import { beforeEach, describe, expect, it, vi } from "vitest";

import { mintCustomerScope } from "@/modules/identity/domain/access-scope";
import {
  InMemoryProviderAccountRepository,
  InMemoryProviderAccountStore,
} from "../../infrastructure/in-memory-provider-account-repository";
import { createProviderAccountForCustomer } from "./create-provider-account-for-customer";

const ADMIN = "99999999-1111-4111-8111-111111111111";
const CUSTOMER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TIER = "99999999-9999-4999-8999-999999999999";
const SERVICE = "11111111-1111-4111-8111-111111111111";

const requireRole = vi.fn();
const actAsCustomer = vi.fn();

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
  actAsCustomer: (...args: unknown[]) => actAsCustomer(...args),
}));

let store: InMemoryProviderAccountStore;

beforeEach(() => {
  store = new InMemoryProviderAccountStore();
  requireRole.mockReset();
  actAsCustomer.mockReset();
});

// PA: ADMIN May Create A Provider Account On A Customer's Behalf.
describe("createProviderAccountForCustomer", () => {
  it("creates an account owned by the target customer's tenant id, not the admin's", async () => {
    requireRole.mockResolvedValue({ role: "ADMIN", userId: ADMIN });
    actAsCustomer.mockResolvedValue(mintCustomerScope(CUSTOMER, CUSTOMER, TIER, ADMIN));

    const deps = { providerAccounts: new InMemoryProviderAccountRepository(store, mintCustomerScope(CUSTOMER, CUSTOMER, TIER, ADMIN)) };

    const account = await createProviderAccountForCustomer(deps, CUSTOMER, {
      serviceId: SERVICE,
      panelUsername: "stella_juan_2024",
    });

    expect(requireRole).toHaveBeenCalledWith("ADMIN");
    expect(actAsCustomer).toHaveBeenCalledWith(CUSTOMER);
    expect(account.tenantId).toBe(CUSTOMER);
    expect(account.tenantId).not.toBe(ADMIN);
    // Audit trail: signed by the acting admin, not the customer.
    expect(account.createdBy).toBe(ADMIN);
  });

  it("propagates a rejection from actAsCustomer (e.g. target is not a CUSTOMER, or is deactivated) without writing anything", async () => {
    requireRole.mockResolvedValue({ role: "ADMIN", userId: ADMIN });
    const denied = new Error("Forbidden");
    actAsCustomer.mockRejectedValue(denied);

    const deps = { providerAccounts: new InMemoryProviderAccountRepository(store, mintCustomerScope(CUSTOMER, CUSTOMER, TIER, ADMIN)) };

    await expect(
      createProviderAccountForCustomer(deps, CUSTOMER, {
        serviceId: SERVICE,
        panelUsername: "stella_juan_2024",
      }),
    ).rejects.toThrow(denied);
    expect(store.accounts).toEqual([]);
  });

  it("propagates a rejection from requireRole('ADMIN') (a RESELLER or CUSTOMER caller) without ever calling actAsCustomer", async () => {
    const denied = new Error("Forbidden");
    requireRole.mockRejectedValue(denied);

    const deps = { providerAccounts: new InMemoryProviderAccountRepository(store, mintCustomerScope(CUSTOMER, CUSTOMER, TIER, ADMIN)) };

    await expect(
      createProviderAccountForCustomer(deps, CUSTOMER, {
        serviceId: SERVICE,
        panelUsername: "stella_juan_2024",
      }),
    ).rejects.toThrow(denied);
    expect(actAsCustomer).not.toHaveBeenCalled();
    expect(store.accounts).toEqual([]);
  });
});
