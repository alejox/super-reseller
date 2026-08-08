import "server-only";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import type { OrderingRepository } from "@/modules/ordering/domain/ordering-repository";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { getDb } from "@/shared/db/client";

export type AdminOrdersDeps = Readonly<{
  ordering: OrderingRepository;
}>;

export async function adminOrdersDeps(): Promise<AdminOrdersDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  const db = getDb();
  return {
    ordering: new DrizzleOrderingRepository(db, scope),
  };
}
