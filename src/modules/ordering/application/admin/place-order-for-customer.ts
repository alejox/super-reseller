import { actAsCustomer, requireRole } from "@/modules/identity/application/dal";
import { tenantIdOf } from "@/modules/identity/domain/access-scope";
import type { UserId } from "@/modules/identity/domain/ids";

import {
  placeOrderAsCustomer,
  type PlaceCustomerOrderDeps,
  type PlaceCustomerOrderResult,
} from "../place-customer-order";

export type PlaceOrderForCustomerDeps = Pick<
  PlaceCustomerOrderDeps,
  "ordering" | "resolveSellablePlan" | "findOwnProviderAccount"
>;

/**
 * ADMIN on-behalf use case (CP: ADMIN May Start A Purchase On A Customer's
 * Behalf; support use case). `requireRole("ADMIN")` re-verifies the caller,
 * then `actAsCustomer(targetUserId)` (`dal.ts`) loads the target from the
 * DATABASE, asserts it is a `CUSTOMER` and not deactivated, and mints a
 * customer scope DOWNGRADED to that one tenant (design.md "Decision:
 * ADMIN-acting-as-customer is a scope downgrade, not a wider admin scope")
 * — a `RESELLER` or any non-existent target never reaches the write below
 * at all.
 *
 * The SAME `placeOrderAsCustomer` use case (self-service) runs against that
 * minted scope: `findOwnProviderAccount` inside it is satisfied by the
 * customer scope's own tenant id, which already IS the validated target.
 */
export async function placeOrderForCustomer(
  deps: PlaceOrderForCustomerDeps,
  targetUserId: UserId,
  input: Readonly<{ planId: string; providerAccountId: string }>,
): Promise<PlaceCustomerOrderResult> {
  await requireRole("ADMIN");
  const scope = await actAsCustomer(targetUserId);

  const tenantId = tenantIdOf(scope);
  if (tenantId === null) {
    // Unreachable: actAsCustomer only ever mints a customer-kind scope, and
    // tenantIdOf's customer branch never returns null.
    throw new Error("actAsCustomer did not produce a tenant-scoped AccessScope.");
  }

  // The acting ADMIN's id, not the customer's — the audit trail costs
  // nothing new (design.md "Decision: ADMIN-acting-as-customer").
  const placedBy = scope.kind === "customer" ? (scope.actingAdminUserId ?? scope.userId) : scope.userId;

  return placeOrderAsCustomer({ ...deps, resellerId: tenantId, placedBy }, input);
}
