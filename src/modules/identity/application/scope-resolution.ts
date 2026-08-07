import type { PriceTierId, ResellerId, TenantId, UserId } from "@/modules/identity/domain/ids";
import type { ScopedUserRow } from "@/modules/identity/domain/scoped-users-repository";
import { ForbiddenError } from "./authorization";
import type { VerifiedSession } from "./session-verifier";

/**
 * Pure scope-minting DECISIONS, extracted from `dal.ts` so the branching
 * logic is unit-testable without `"server-only"`, `next/headers`, or a
 * database. Deliberately NOT `AccessScope` itself: the minters
 * (`mintAdminScope`/`mintResellerScope`/`mintCustomerScope`) stay sealed to
 * `dal.ts` by eslint.config.mjs ("AccessScope minters may only be imported
 * by ... dal.ts — the DAL mints scopes from a DB-verified session row").
 * `dal.ts` calls the matching mint function for the `kind` this module
 * decided on; this module never mints anything itself.
 */
export type ScopeInput =
  | Readonly<{ kind: "admin"; userId: UserId }>
  | Readonly<{ kind: "reseller"; userId: UserId; resellerId: ResellerId; priceTierId: PriceTierId }>
  | Readonly<{
      kind: "customer";
      userId: UserId;
      tenantId: TenantId;
      priceTierId: PriceTierId;
      actingAdminUserId: UserId | null;
    }>;

/**
 * Decides the `AccessScope` shape for a verified session row (design.md
 * interfaces: "the single production bridge between 'who is asking' and
 * 'what SQL may run'"). Built from the DB row (`VerifiedSession`), never
 * from the cookie.
 */
export function scopeInputFromSession(session: VerifiedSession): ScopeInput {
  if (session.role === "ADMIN") {
    return { kind: "admin", userId: session.userId };
  }

  // The schema's `users_tier_matches_role` CHECK makes a tier-less RESELLER
  // or CUSTOMER unrepresentable, so this can only fire if the row was
  // written around the constraint. Failing loudly beats minting a scope
  // with a missing tier, which would silently widen what this account sees.
  if (session.resellerId === null || session.priceTierId === null) {
    throw new Error(`${session.role} ${session.userId} has no tenant id or price tier`);
  }

  if (session.role === "CUSTOMER") {
    // `users.reseller_id` is the generalized tenancy column (design.md
    // "Single-Level Tenant Ownership"): for a CUSTOMER row it IS that
    // customer's own tenant id, never a reseller's.
    return {
      kind: "customer",
      userId: session.userId,
      tenantId: session.resellerId,
      priceTierId: session.priceTierId,
      actingAdminUserId: null,
    };
  }

  return {
    kind: "reseller",
    userId: session.userId,
    resellerId: session.resellerId,
    priceTierId: session.priceTierId,
  };
}

/**
 * The core decision behind `dal.ts#actAsCustomer` (design.md "Decision:
 * ADMIN-acting-as-customer is a scope downgrade, not a wider admin scope").
 * Given the acting ADMIN's own id and the target row already loaded from
 * the database, decides the customer scope input for the TARGET — narrower
 * than an admin scope, every query filtered to that one customer's tenant —
 * or rejects when the target cannot lawfully be acted for.
 */
export function resolveActingCustomerScopeInput(
  actingAdminUserId: UserId,
  target: ScopedUserRow | null,
): ScopeInput {
  if (target === null || target.role !== "CUSTOMER" || target.deactivatedAt !== null) {
    throw new ForbiddenError();
  }
  if (target.resellerId === null || target.priceTierId === null) {
    // Unreachable under `users_tier_matches_role`, same defensive shape as
    // scopeInputFromSession's guard above.
    throw new Error(`CUSTOMER ${target.id} has no tenant id or price tier`);
  }

  return {
    kind: "customer",
    userId: target.id,
    tenantId: target.resellerId,
    priceTierId: target.priceTierId,
    actingAdminUserId,
  };
}
