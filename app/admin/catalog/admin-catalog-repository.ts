import "server-only";

import type { AdminCatalogRepository } from "@/modules/catalog/domain/catalog-repository";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { getDb } from "@/shared/db/client";

/**
 * Resolves the ADMIN catalog repository for the current request.
 *
 * Lives outside `actions.ts` because that file carries `"use server"`, which
 * requires every export to be an async Server Action — a shared helper there
 * would be published as a callable endpoint.
 *
 * The `kind` check is not redundant with `requireRole`. `requireRole` proves
 * the role at RUNTIME; `getScope()` still returns the full `AccessScope`
 * union, so without narrowing, `factory.for(scope)` returns
 * `AdminCatalogRepository | ResellerCatalogRepository` and the admin-only
 * methods are unreachable — the compiler refusing to hand out `createService`
 * without proof of an admin scope is the type-level half of the same rule.
 */
export async function adminCatalogRepository(): Promise<AdminCatalogRepository> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    // Unreachable after `requireRole("ADMIN")`: the scope is built from the
    // same DB-verified session row the role came from. Throwing beats a cast,
    // which would silently paper over a future divergence between the two.
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  return createDrizzleScopedCatalogRepositoryFactory(getDb()).for(scope);
}
