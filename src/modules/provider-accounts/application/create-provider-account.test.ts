import { beforeEach, describe, expect, it } from "vitest";

import { mintCustomerScope, mintResellerScope, type AccessScope } from "@/modules/identity/domain/access-scope";
import { ForbiddenError } from "@/modules/identity/application/authorization";
import {
  InMemoryProviderAccountRepository,
  InMemoryProviderAccountStore,
} from "../infrastructure/in-memory-provider-account-repository";
import { createProviderAccount } from "./create-provider-account";

const CUSTOMER_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RESELLER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TIER = "99999999-9999-4999-8999-999999999999";
const SERVICE = "11111111-1111-4111-8111-111111111111";

let store: InMemoryProviderAccountStore;

function repoFor(scope: AccessScope) {
  return { providerAccounts: new InMemoryProviderAccountRepository(store, scope) };
}

beforeEach(() => {
  store = new InMemoryProviderAccountStore();
});

// PA: A Customer Creates Their Own Provider Account.
describe("createProviderAccount (self-service and shared use case)", () => {
  it("lets a CUSTOMER create an account owned by their own tenant id", async () => {
    const scope = mintCustomerScope(CUSTOMER_A, CUSTOMER_A, TIER);

    const account = await createProviderAccount(repoFor(scope), scope, CUSTOMER_A, {
      serviceId: SERVICE,
      panelUsername: "stella_juan_2024",
      label: "Principal",
    });

    expect(account.tenantId).toBe(CUSTOMER_A);
    expect(account.createdBy).toBe(CUSTOMER_A);
  });

  it("denies a CUSTOMER naming a different customer's tenant id as owner", async () => {
    const scope = mintCustomerScope(CUSTOMER_A, CUSTOMER_A, TIER);

    await expect(
      createProviderAccount(repoFor(scope), scope, CUSTOMER_B, {
        serviceId: SERVICE,
        panelUsername: "stella_juan_2024",
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(store.accounts).toEqual([]);
  });

  // PA: ADMIN May Create A Provider Account On A Customer's Behalf —
  // "Reseller cannot create a provider account".
  it("denies a RESELLER outright, naming itself or any customer as owner", async () => {
    const resellerScope = mintResellerScope(RESELLER_A, RESELLER_A, TIER);

    await expect(
      createProviderAccount(repoFor(resellerScope), resellerScope, RESELLER_A, {
        serviceId: SERVICE,
        panelUsername: "stella_juan_2024",
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      createProviderAccount(repoFor(resellerScope), resellerScope, CUSTOMER_A, {
        serviceId: SERVICE,
        panelUsername: "stella_juan_2024",
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(store.accounts).toEqual([]);
  });

  it("signs an on-behalf creation with the acting admin's id, not the customer's", async () => {
    const ADMIN = "99999999-1111-4111-8111-111111111111";
    const onBehalfScope = mintCustomerScope(CUSTOMER_A, CUSTOMER_A, TIER, ADMIN);

    const account = await createProviderAccount(repoFor(onBehalfScope), onBehalfScope, CUSTOMER_A, {
      serviceId: SERVICE,
      panelUsername: "stella_juan_2024",
    });

    expect(account.tenantId).toBe(CUSTOMER_A);
    expect(account.createdBy).toBe(ADMIN);
  });
});
