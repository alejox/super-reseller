import type { AccessScope } from "@/modules/identity/domain/access-scope";
import { assertActorAuthorizedForSubject } from "@/modules/identity/application/authorization";

import type { TenantId } from "../domain/ids";
import type { ProviderAccount } from "../domain/provider-account";
import type { ProviderAccountRepository } from "../domain/provider-account-repository";

export type CreateProviderAccountDeps = Readonly<{
  providerAccounts: Pick<ProviderAccountRepository, "create">;
}>;

export type CreateProviderAccountInput = Readonly<{
  serviceId: string;
  panelUsername: string;
  label?: string | null;
}>;

/**
 * PA: A Customer Creates Their Own Provider Account / PA: ADMIN May Create A
 * Provider Account On A Customer's Behalf — the ONE use case both the
 * self-service and the ADMIN-on-behalf Server Actions call (design.md
 * interfaces). `targetTenantId` is the account's intended OWNER; `scope` is
 * who is asking.
 *
 * `assertActorAuthorizedForSubject` (identity/application/authorization.ts,
 * AUTH: Actor-Subject Distinction For ADMIN-On-Behalf Operations) is the
 * single authorization gate, and it runs here — not only at the Server
 * Action boundary — as defense-in-depth, the same shape every Server Action
 * in this codebase re-checks its own role even though the page above it was
 * already gated:
 *
 * - A CUSTOMER scope passes only when its OWN tenant id is the target
 *   (self-service — PA: "Customer cannot create an account for another
 *   customer").
 * - The customer scope `dal.ts#actAsCustomer` mints for an ADMIN acting
 *   on-behalf passes too, because its own tenant id already IS the
 *   validated target (design.md "Decision: ADMIN-acting-as-customer is a
 *   scope downgrade").
 * - A RESELLER scope is refused outright, for any target (PA: "Reseller
 *   cannot create a provider account").
 *
 * `createdBy` is `scope.actingAdminUserId ?? scope.userId` — a self-service
 * creation is signed by the customer, an on-behalf one by the acting ADMIN,
 * so the audit trail costs nothing new (design.md "Decision:
 * ADMIN-acting-as-customer").
 */
export async function createProviderAccount(
  deps: CreateProviderAccountDeps,
  scope: AccessScope,
  targetTenantId: TenantId,
  input: CreateProviderAccountInput,
): Promise<ProviderAccount> {
  assertActorAuthorizedForSubject(scope, targetTenantId);

  return deps.providerAccounts.create({
    tenantId: targetTenantId,
    serviceId: input.serviceId,
    panelUsername: input.panelUsername,
    label: input.label,
    createdBy: scope.kind === "customer" ? (scope.actingAdminUserId ?? scope.userId) : scope.userId,
  });
}
