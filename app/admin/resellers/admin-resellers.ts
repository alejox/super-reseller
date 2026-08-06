import "server-only";

import type { AdminCatalogRepository } from "@/modules/catalog/domain/catalog-repository";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import { DrizzleUserProvisioning } from "@/modules/identity/infrastructure/drizzle-user-provisioning";
import { DrizzleCredentialsRepository } from "@/modules/identity/infrastructure/drizzle-credentials-repository";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import type { ScopedUsersRepository } from "@/modules/identity/domain/scoped-users-repository";
import type { CredentialsRepository } from "@/modules/identity/domain/credentials-repository";
import type { UserProvisioning } from "@/modules/identity/domain/user-provisioning";
import { getDb } from "@/shared/db/client";

/**
 * The reseller screen's composition root.
 *
 * Resellers are the one feature that genuinely spans both modules — an
 * account belongs to identity, the price tier it is pinned to belongs to
 * catalog — and eslint.config.mjs forbids either module from importing the
 * other. `app/` is the only layer allowed to hold both halves, so the wiring
 * lives here rather than inside either module.
 */

export type AdminResellerDeps = Readonly<{
  users: ScopedUsersRepository;
  credentials: CredentialsRepository;
  provisioning: UserProvisioning;
  catalog: AdminCatalogRepository;
}>;

export async function adminResellerDeps(): Promise<AdminResellerDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    // Unreachable after `requireRole("ADMIN")`: the scope is built from the
    // same DB-verified session row the role came from. Throwing beats a cast.
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  const db = getDb();
  return {
    users: new DrizzleScopedUsersRepository(db, scope),
    credentials: new DrizzleCredentialsRepository(db),
    provisioning: new DrizzleUserProvisioning(db),
    catalog: createDrizzleScopedCatalogRepositoryFactory(db).for(scope),
  };
}
