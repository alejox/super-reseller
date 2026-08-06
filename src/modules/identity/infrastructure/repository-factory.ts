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

/** Role-narrowed repository surface selected by a scope's kind. */
export type RepoFor<S extends AccessScope> = S extends { kind: "reseller" }
  ? ResellerCatalogRepository
  : AdminCatalogRepository;

export interface CatalogRepositoryFactory {
  /**
   * Returns the repository surface that `scope` may lawfully touch:
   * ADMIN → full admin surface; RESELLER → sellable-only surface where
   * the tier is read from the scope, never accepted as a parameter.
   */
  for<S extends AccessScope>(scope: S): RepoFor<S>;
}

/**
 * Concrete factory (4.7–4.9). An ADMIN scope gets the full unscoped
 * surface; a RESELLER scope gets a sellable-only adapter bound to the
 * scope's tier at construction — the tier is read from the scope and never
 * accepted as a parameter, so an unscoped or cross-tier query is not
 * expressible (design.md: "SQL forced to tier = scope.priceTierId").
 *
 * The reseller adapter is injected as a factory so this class stays
 * backend-agnostic: the caller wires the same store twice —
 * `(store, (scope) => new DrizzleResellerCatalogRepository(db, scope.priceTierId))`
 * for production, the in-memory equivalent for tests.
 */
export class ScopedRepositoryFactory implements CatalogRepositoryFactory {
  constructor(
    private readonly adminRepository: AdminCatalogRepository,
    private readonly resellerRepositoryFor: (
      scope: Extract<AccessScope, { kind: "reseller" }>,
    ) => ResellerCatalogRepository,
  ) {}

  for<S extends AccessScope>(scope: S): RepoFor<S> {
    if (scope.kind === "reseller") {
      return this.resellerRepositoryFor(scope) as RepoFor<S>;
    }
    // The unscoped adapter IS the admin repository: an ADMIN scope sees
    // every row (`tenantWhere` returns no filter for admin scopes).
    // The cast narrows the generic conditional; the value is the same
    // `AdminCatalogRepository` in both type and runtime.
    return this.adminRepository as RepoFor<S>;
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
