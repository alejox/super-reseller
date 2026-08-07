import type { AccessScope } from "../domain/access-scope";
import type { ModuleDb } from "@/shared/db/module-db";
import type {
  AdminCatalogRepository,
  ResellerCatalogRepository,
} from "@/modules/catalog/domain/catalog-repository";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { DrizzleResellerCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-reseller-catalog-repository";

/**
 * The repository gate (design.md: "multi-tenant isolation is enforced by
 * an unforgeable AccessScope token that every repository factory demands,
 * so an unscoped query is a compile error rather than a code-review
 * finding").
 *
 * Lint note: this file is the sanctioned cross-module gate. It consumes
 * identity's `AccessScope` and returns catalog's role-narrowed repository
 * PORT types (interfaces, not entity types), so eslint.config.mjs exempts
 * exactly this file from the `@/modules/catalog/*` alias ban while keeping
 * the AccessScope-minter restriction.
 */

/**
 * Role-narrowed repository surface selected by a scope's kind.
 *
 * ADMIN is the ONLY variant that maps to the unscoped admin surface; every
 * other scope kind — RESELLER today, CUSTOMER as of this change — maps to
 * the tier-bound sellable surface (design.md: "`repository-factory.ts`
 * carries a live footgun that must be inverted, not extended: today
 * `RepoFor<S> = S extends {kind:'reseller'} ? Reseller… : Admin…`, so a
 * customer scope would receive the unscoped admin catalog"). Keying off
 * `{kind: "admin"}` instead of `{kind: "reseller"}` is what makes a future
 * non-admin scope variant fall safely into the tier-bound branch by
 * default, rather than into the unscoped one.
 */
export type RepoFor<S extends AccessScope> = S extends { kind: "admin" }
  ? AdminCatalogRepository
  : ResellerCatalogRepository;

export interface CatalogRepositoryFactory {
  /**
   * Returns the repository surface that `scope` may lawfully touch:
   * ADMIN → full admin surface; RESELLER → sellable-only surface where
   * the tier is read from the scope, never accepted as a parameter.
   */
  for<S extends AccessScope>(scope: S): RepoFor<S>;
}

/**
 * Concrete factory (4.7–4.9, generalized in this change). An ADMIN scope
 * gets the full unscoped surface; every OTHER scope kind — RESELLER,
 * CUSTOMER — gets a sellable-only adapter bound to that scope's own tier at
 * construction — the tier is read from the scope and never accepted as a
 * parameter, so an unscoped or cross-tier query is not expressible
 * (design.md: "SQL forced to tier = scope.priceTierId"). Both non-admin
 * variants carry `priceTierId`, so the customer's retail price resolves
 * through the SAME tier-bound adapter a reseller uses — zero new pricing
 * machinery.
 *
 * The reseller/customer adapter is injected as a factory so this class
 * stays backend-agnostic: the caller wires the same store twice —
 * `(store, (scope) => new DrizzleResellerCatalogRepository(db, scope.priceTierId))`
 * for production, the in-memory equivalent for tests.
 */
export class ScopedRepositoryFactory implements CatalogRepositoryFactory {
  constructor(
    private readonly adminRepository: AdminCatalogRepository,
    private readonly resellerRepositoryFor: (
      scope: Exclude<AccessScope, { kind: "admin" }>,
    ) => ResellerCatalogRepository,
  ) {}

  for<S extends AccessScope>(scope: S): RepoFor<S> {
    if (scope.kind === "admin") {
      // The unscoped adapter IS the admin repository: an ADMIN scope sees
      // every row (`tenantWhere` returns no filter for admin scopes).
      // The cast narrows the generic conditional; the value is the same
      // `AdminCatalogRepository` in both type and runtime.
      return this.adminRepository as RepoFor<S>;
    }
    // Every non-admin scope — RESELLER today, CUSTOMER as of this change —
    // gets the tier-bound sellable adapter. Before this fix only "reseller"
    // took this branch and every other scope fell through to the unscoped
    // admin repository above.
    return this.resellerRepositoryFor(scope) as RepoFor<S>;
  }
}

export function createDrizzleScopedCatalogRepositoryFactory(
  db: ModuleDb,
): ScopedRepositoryFactory {
  return new ScopedRepositoryFactory(
    new DrizzleCatalogRepository(db),
    (scope) => new DrizzleResellerCatalogRepository(db, scope.priceTierId),
  );
}
