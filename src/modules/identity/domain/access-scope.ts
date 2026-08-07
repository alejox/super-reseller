import type { PriceTierId, ResellerId, TenantId, UserId } from "./ids";

/**
 * AccessScope — opaque, branded, unforgeable scope token (design.md:
 * "AccessScope is an opaque branded token minted only by the DAL").
 *
 * `scopeBrand` is deliberately NOT exported: no module outside this file
 * can name it, so no object literal can satisfy `AccessScope`, and an
 * unscoped repository construction is a compile error rather than a
 * review finding. The only producers are the mint functions below, and
 * eslint.config.mjs restricts importing them to
 * identity/application/dal.ts, which mints from a DB-verified session row.
 */
const scopeBrand: unique symbol = Symbol("access-scope-brand");

export type AccessScope =
  | { readonly [scopeBrand]: true; kind: "admin"; userId: UserId }
  | {
      readonly [scopeBrand]: true;
      kind: "reseller";
      userId: UserId;
      resellerId: ResellerId;
      priceTierId: PriceTierId;
    }
  | {
      readonly [scopeBrand]: true;
      kind: "customer";
      userId: UserId;
      tenantId: TenantId;
      priceTierId: PriceTierId;
      /** null when the customer acts for itself; the ADMIN's id when acting on its behalf. */
      actingAdminUserId: UserId | null;
    };

/**
 * Maps a scope to its user role. Consumed by the 4.7 repository factory
 * (`for<S extends AccessScope>` returning role-narrowed repositories):
 * an ADMIN scope selects the admin repository shape, RESELLER and CUSTOMER
 * scopes both select the tier-bound sellable one.
 */
export type ScopeRole<S extends AccessScope> = S extends { kind: "reseller" }
  ? "RESELLER"
  : S extends { kind: "customer" }
    ? "CUSTOMER"
    : "ADMIN";

export function mintAdminScope(userId: UserId): AccessScope {
  return { [scopeBrand]: true, kind: "admin", userId };
}

export function mintResellerScope(
  userId: UserId,
  resellerId: ResellerId,
  priceTierId: PriceTierId,
): AccessScope {
  return { [scopeBrand]: true, kind: "reseller", userId, resellerId, priceTierId };
}

/**
 * Mints a customer scope. `actingAdminUserId` is null when the customer
 * acts for itself and the acting ADMIN's id when `dal.ts#actAsCustomer`
 * mints on the customer's behalf (design.md "Decision: ADMIN-acting-as-
 * customer is a scope downgrade, not a wider admin scope") — a *field* on
 * the customer scope, invisible to SQL filtering, that reaches only the
 * audit column (`placed_by`/`created_by` = `actingAdminUserId ?? userId`).
 */
export function mintCustomerScope(
  userId: UserId,
  tenantId: TenantId,
  priceTierId: PriceTierId,
  actingAdminUserId: UserId | null = null,
): AccessScope {
  return {
    [scopeBrand]: true,
    kind: "customer",
    userId,
    tenantId,
    priceTierId,
    actingAdminUserId,
  };
}

/**
 * The ONE reader of a scope's tenant id (design.md interfaces). Every other
 * tenant-aware consumer — `tenantWhere`, the repository factory — goes
 * through this function, never through `scope.kind` directly, so a fourth
 * `AccessScope` variant is a compile error exactly HERE (the `default`
 * branch's `never` assignment), and nowhere else has to be found and fixed.
 */
export function tenantIdOf(scope: AccessScope): TenantId | null {
  switch (scope.kind) {
    case "admin":
      // Sees all — no tenant filter.
      return null;
    case "reseller":
      return scope.resellerId;
    case "customer":
      return scope.tenantId;
    default: {
      const exhaustive: never = scope;
      throw new Error(`Unhandled AccessScope kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}
