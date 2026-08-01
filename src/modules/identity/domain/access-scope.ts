import type { PriceTierId, ResellerId, UserId } from "./ids";

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
    };

/**
 * Maps a scope to its user role. Consumed by the 4.7 repository factory
 * (`for<S extends AccessScope>` returning role-narrowed repositories):
 * an ADMIN scope selects the admin repository shape, a RESELLER scope the
 * reseller one.
 */
export type ScopeRole<S extends AccessScope> = S extends { kind: "reseller" }
  ? "RESELLER"
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
