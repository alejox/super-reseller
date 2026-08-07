import type { PriceTierId, ResellerId, UserId } from "./ids";

export type NewAdminUser = Readonly<{
  id: UserId;
  /** Already normalized — see `normalizeEmail`. */
  email: string;
  /** argon2id PHC string. The plaintext password never reaches this port. */
  passwordHash: string;
  createdAt: Date;
}>;

/**
 * A reseller account. Unlike an admin it carries two extra ids, and neither
 * is optional:
 *
 * - `resellerId` is the ownership axis `tenantWhere` filters on (IT:
 *   Single-Level Reseller Ownership). A top-level reseller owns its own
 *   tenant, so the row carries the id it was issued — without it the
 *   reseller cannot read its own row back.
 * - `priceTierId` decides every price this account will ever see.
 *   `users_reseller_requires_tier` makes a tier-less RESELLER
 *   unrepresentable, so the type matches the constraint: not nullable.
 */
export type NewResellerUser = Readonly<{
  id: UserId;
  email: string;
  passwordHash: string;
  resellerId: ResellerId;
  priceTierId: PriceTierId;
  createdAt: Date;
}>;

/**
 * A customer account. Structurally identical to `NewResellerUser` — both
 * roles carry the same two non-optional ids under
 * `users_tier_matches_role` — but kept as its own type rather than a type
 * alias: the two roles are provisioned through different use cases with
 * different callers (an ADMIN creates a reseller from the admin panel; the
 * same is true for a customer, but the two are never confused at the call
 * site, and a future divergence in what a customer row carries should not
 * require touching `NewResellerUser`).
 */
export type NewCustomerUser = Readonly<{
  id: UserId;
  email: string;
  passwordHash: string;
  /** The customer's own freestanding tenant id (CI: Customer Gets Its Own Tenant Id). */
  resellerId: ResellerId;
  priceTierId: PriceTierId;
  createdAt: Date;
}>;

/**
 * Account creation. Separate from `ScopedUsersRepository` because it runs
 * before any session exists — this is the bootstrap path that creates the
 * FIRST admin, when there is nobody to authorize it.
 *
 * `createReseller`/`createCustomer` run the other way round: behind a real
 * ADMIN session, from the admin panel (CI: Only ADMIN Provisions A
 * Customer). They live on the same port because all three write the same
 * table under the same CHECK, and keeping them together is what makes the
 * asymmetry in that CHECK visible in one place.
 */
export interface UserProvisioning {
  createAdmin(user: NewAdminUser): Promise<void>;
  createReseller(user: NewResellerUser): Promise<void>;
  createCustomer(user: NewCustomerUser): Promise<void>;
}
