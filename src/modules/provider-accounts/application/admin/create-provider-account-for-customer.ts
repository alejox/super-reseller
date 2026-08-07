import { actAsCustomer, requireRole } from "@/modules/identity/application/dal";
import { tenantIdOf } from "@/modules/identity/domain/access-scope";
import type { UserId } from "@/modules/identity/domain/ids";

import type { ProviderAccount } from "../../domain/provider-account";
import type { ProviderAccountRepository } from "../../domain/provider-account-repository";
import { createProviderAccount, type CreateProviderAccountInput } from "../create-provider-account";

export type CreateProviderAccountForCustomerDeps = Readonly<{
  providerAccounts: Pick<ProviderAccountRepository, "create">;
}>;

/**
 * ADMIN on-behalf use case (PA: ADMIN May Create A Provider Account On A
 * Customer's Behalf; support use case). `requireRole("ADMIN")` re-verifies
 * the caller, then `actAsCustomer(targetUserId)` (`dal.ts`) loads the
 * target from the DATABASE, asserts it is a `CUSTOMER` and not deactivated,
 * and mints a customer scope DOWNGRADED to that one tenant (design.md
 * "Decision: ADMIN-acting-as-customer is a scope downgrade, not a wider
 * admin scope") — a `RESELLER` or any non-existent target never reaches the
 * write below at all.
 *
 * The SAME `createProviderAccount` use case 2.15 (self-service) uses then
 * runs against that minted scope: `assertActorAuthorizedForSubject` inside
 * it is trivially satisfied, because the scope's own tenant id already IS
 * the validated target — there is exactly one write path, not two.
 */
export async function createProviderAccountForCustomer(
  deps: CreateProviderAccountForCustomerDeps,
  targetUserId: UserId,
  input: CreateProviderAccountInput,
): Promise<ProviderAccount> {
  await requireRole("ADMIN");
  const scope = await actAsCustomer(targetUserId);

  const tenantId = tenantIdOf(scope);
  if (tenantId === null) {
    // Unreachable: actAsCustomer only ever mints a customer-kind scope, and
    // tenantIdOf's customer branch never returns null.
    throw new Error("actAsCustomer did not produce a tenant-scoped AccessScope.");
  }

  return createProviderAccount(deps, scope, tenantId, input);
}
