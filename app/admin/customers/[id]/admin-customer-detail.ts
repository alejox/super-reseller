import "server-only";

import type { AdminCatalogRepository } from "@/modules/catalog/domain/catalog-repository";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import type { ScopedUserRow } from "@/modules/identity/domain/scoped-users-repository";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import type { ProviderAccountRepository } from "@/modules/provider-accounts/domain/provider-account-repository";
import { DrizzleProviderAccountRepository } from "@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository";
import { getDb } from "@/shared/db/client";

/**
 * The admin customer-detail screen's composition root — the same shape as
 * `app/admin/customers/admin-customers.ts`. The ADMIN's OWN scope reads
 * every tenant (`tenantWhere` returns no filter for an admin scope), so the
 * target customer's rows are reached by naming their tenant id explicitly,
 * not by minting an `actAsCustomer` scope — this view is read-only, not a
 * write path, and `catalog` here is the FULL admin surface (`listServices`)
 * rather than the tier-bound sellable one `app/account` uses.
 */

export type AdminCustomerDetailDeps = Readonly<{
  target: ScopedUserRow | null;
  providerAccounts: ProviderAccountRepository;
  catalog: AdminCatalogRepository;
}>;

export async function adminCustomerDetailDeps(targetUserId: string): Promise<AdminCustomerDetailDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  const db = getDb();
  const users = await new DrizzleScopedUsersRepository(db, scope).listUsers();
  const target = users.find((user) => user.id === targetUserId && user.role === "CUSTOMER") ?? null;

  return {
    target,
    providerAccounts: new DrizzleProviderAccountRepository(db, scope),
    catalog: createDrizzleScopedCatalogRepositoryFactory(db).for(scope),
  };
}
