import "server-only";

import { getScope } from "@/modules/identity/application/dal";
import { DrizzleInventoryRepository, InventoryRepository } from "@/modules/inventory/infrastructure/drizzle-inventory-repository";
import { getDb } from "@/shared/db/client";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import type { ScopedUsersRepository } from "@/modules/identity/domain/scoped-users-repository";
import type { AdminCatalogRepository } from "@/modules/catalog/domain/catalog-repository";

export type AdminInventoryDeps = Readonly<{
  inventory: InventoryRepository;
  users: ScopedUsersRepository;
  catalog: AdminCatalogRepository;
  actorId: string;
}>;

export async function adminInventoryDeps(): Promise<AdminInventoryDeps> {
  const scope = await getScope(); // gets the current scope
  
  const db = getDb();
  return {
    inventory: new DrizzleInventoryRepository(db),
    users: new DrizzleScopedUsersRepository(db, scope),
    catalog: createDrizzleScopedCatalogRepositoryFactory(db).for(scope) as AdminCatalogRepository,
    actorId: scope.userId,
  };
}
