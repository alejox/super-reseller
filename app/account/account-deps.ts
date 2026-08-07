import "server-only";

import type { ResellerCatalogRepository } from "@/modules/catalog/domain/catalog-repository";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { DrizzleProviderAccountRepository } from "@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository";
import type { ProviderAccountRepository } from "@/modules/provider-accounts/domain/provider-account-repository";
import { getDb } from "@/shared/db/client";

/**
 * The customer panel's composition root — the same shape as
 * `app/admin/customers/admin-customers.ts`. `catalog` is the tier-bound
 * sellable surface (the customer's own scope, per design.md "Decision:
 * `repository-factory.ts` … tier-bound for every non-admin"), used only to
 * source the provider/service picker for the create form — a plan without a
 * current price at this customer's tier does not offer that provider
 * either, which is the honest answer.
 */

export type AccountDeps = Readonly<{
  providerAccounts: ProviderAccountRepository;
  catalog: ResellerCatalogRepository;
  tenantId: string;
}>;

export async function accountDeps(): Promise<AccountDeps> {
  await requireRole("CUSTOMER");
  const scope = await getScope();

  if (scope.kind !== "customer") {
    // Unreachable after `requireRole("CUSTOMER")`: the scope is built from
    // the same DB-verified session row the role came from.
    throw new Error("A CUSTOMER session did not produce a customer scope.");
  }

  const db = getDb();
  return {
    providerAccounts: new DrizzleProviderAccountRepository(db, scope),
    catalog: createDrizzleScopedCatalogRepositoryFactory(db).for(scope),
    tenantId: scope.tenantId,
  };
}
