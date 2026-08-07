/**
 * Type-level negative + positive fixture for the AccessScope gates
 * (tasks 4.5 + 4.7).
 *
 * NEVER executed — checked only by `npx tsc --noEmit` (tsconfig's
 * include list covers every `*.ts` file, this one included). Proves the
 * design's core guarantee (design.md: "AccessScope is an opaque branded
 * token minted only by the DAL"): the brand symbol is declared but NOT
 * exported, so no object literal can satisfy `AccessScope`; the repository
 * factory narrows its return type by scope role (ADMIN full surface,
 * RESELLER sellable-only, tier never a parameter); and `tenantWhere`
 * accepts only tables that declare a `reseller_id` column.
 *
 * Every `@ts-expect-error` below must land on a real error. If
 * `AccessScope` ever becomes forgeable by a literal, or the factory /
 * `tenantWhere` type gates weaken, the directive is unused and tsc fails —
 * the fixture fails closed.
 */
import { type SQL } from "drizzle-orm";

import { type AccessScope } from "@/modules/identity/domain/access-scope";
import { ScopedRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { plan } from "@/modules/catalog/infrastructure/catalog.schema";
import {
  type ResellerCatalogRepository,
  type SellablePlan,
} from "@/modules/catalog/domain/catalog-repository";
import { type PlanId, type PriceTierId } from "@/modules/catalog/domain/ids";
import { InMemoryCatalogRepository } from "@/modules/catalog/infrastructure/in-memory-catalog-repository";
import { InMemoryResellerCatalogRepository } from "@/modules/catalog/infrastructure/in-memory-reseller-catalog-repository";
import { users } from "@/modules/identity/infrastructure/identity.schema";
import { tenantWhere } from "@/shared/db/tenant";

// A REAL factory instance over a real catalog adapter (the same ports the
// DAL flow `repo.for(scope)` will use in slice 5b). The fixture never
// executes, so no mint is involved — the scope VALUES below are ambient,
// because the minters are lint-sealed to dal.ts (and tests). The reseller
// branch is wired exactly as production will: same store, tier bound from
// the scope at construction.
const store = new InMemoryCatalogRepository();
const factory = new ScopedRepositoryFactory(
  store,
  (scope) => new InMemoryResellerCatalogRepository(store, scope.priceTierId),
);

// `Extract<AccessScope, { kind: X }>` picks the exact union member — the
// same type the corresponding mint function produces.
declare const adminScope: Extract<AccessScope, { kind: "admin" }>;
declare const resellerScope: Extract<AccessScope, { kind: "reseller" }>;
declare const customerScope: Extract<AccessScope, { kind: "customer" }>;

// ── Negative proof 1: a bare literal cannot satisfy AccessScope ────────────
// @ts-expect-error — `{ kind: 'admin' }` lacks the unforgeable brand property
factory.for({ kind: "admin" })

// ── Negative proof 2: a full mock-shaped literal cannot either ─────────────
// @ts-expect-error — a mock scope with every visible field still lacks the brand
factory.for({
  kind: "reseller",
  userId: "user-2",
  resellerId: "reseller-2",
  priceTierId: "tier-1",
})

// ── Negative proof 3: direct assignment is equally impossible ──────────────
// Exported so ESLint's no-unused-vars never fires on a compile-time-only
// binding.
// @ts-expect-error — an object literal cannot satisfy AccessScope, period
export const forgedAdminScope: AccessScope = { kind: "admin" }

// ── Positive proof 4: an ADMIN scope exposes the full admin surface ────────
// `createPlan` exists only on AdminCatalogRepository — this compiles only
// if the factory narrows an admin scope to the admin shape.
export const adminCreatesPlan = factory.for(adminScope).createPlan
// The admin surface KEEPS the tier-parametric sellable lookup.
export const adminSellableLookup: (
  planId: PlanId,
  tierId: PriceTierId,
) => Promise<SellablePlan | null> = factory.for(adminScope).findSellablePlan

// ── Positive proof 5: a RESELLER scope is narrowed to the sellable-only
// ── surface, and the tier parameter is GONE (tier comes from the scope) ───
export const resellerRepos: ResellerCatalogRepository = factory.for(resellerScope)
export const resellerSellableLookup: (planId: PlanId) => Promise<SellablePlan | null> =
  factory.for(resellerScope).findSellablePlan

// ── Negative proof 6: admin methods are REMOVED from the reseller surface ──
// @ts-expect-error — `createPlan` is not part of ResellerCatalogRepository
export const resellerCannotCreatePlan = factory.for(resellerScope).createPlan

// ── Positive proof 6b: a CUSTOMER scope is narrowed to the SAME
// ── sellable-only surface as a RESELLER scope (RepoFor<S> keys off "admin",
// ── not "reseller" — design.md: "the live footgun that must be inverted").
// ── This compiles only if a customer scope reaches the tier-bound branch.
export const customerRepos: ResellerCatalogRepository = factory.for(customerScope)
export const customerSellableLookup: (planId: PlanId) => Promise<SellablePlan | null> =
  factory.for(customerScope).findSellablePlan

// ── Negative proof 6c: admin methods are REMOVED from the customer surface
// ── too — the same live footgun this change closes would have handed a
// ── customer scope the FULL admin surface, including createPlan.
// @ts-expect-error — `createPlan` is not part of ResellerCatalogRepository
export const customerCannotCreatePlan = factory.for(customerScope).createPlan

// ── Positive proof 7: tenantWhere accepts a table WITH reseller_id ────────
// ADMIN → no reseller filter (undefined); RESELLER → reseller_id predicate.
export const adminTenantClause: SQL | undefined = tenantWhere(users, adminScope)
export const resellerTenantClause: SQL | undefined = tenantWhere(users, resellerScope)

// ── Negative proof 8: tenantWhere rejects a table WITHOUT reseller_id ─────
// `plan` (catalog) declares no reseller_id — the type system, not a
// convention, requires the column (design.md: "A table lacking reseller_id
// cannot be passed to it").
// @ts-expect-error — `plan` has no reseller_id column
tenantWhere(plan, adminScope)
