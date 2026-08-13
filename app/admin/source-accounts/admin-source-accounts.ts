import "server-only";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import type { SourceAccountDeps } from "@/modules/source-accounts/application/admin/manage-source-accounts";
import { DrizzleSourceAccountRepository } from "@/modules/source-accounts/infrastructure/drizzle-source-account-repository";
import { getDb } from "@/shared/db/client";

/**
 * The source-accounts screen's composition root.
 *
 * THIS IS THE ONLY GUARD ON THE TABLE. `source_account` has no `reseller_id`
 * to scope by — it is platform infrastructure, not tenant data — so unlike the
 * tenant-scoped repositories, nothing structural stops an unscoped read
 * further down. `requireRole("ADMIN")` here is the whole boundary, exactly as
 * it is for `topup_settings`. Do not construct
 * `DrizzleSourceAccountRepository` anywhere that has not run it.
 *
 * No catalog repository: a supplier panel login belongs to a SUPPLIER, not to
 * a streaming service. The plans it sells ("Plan de 1 Dispositivo", "Plan de 3
 * Dispositivos") are the supplier's own catalogue and arrive with each sync —
 * this platform's `service` table has nothing to say about them.
 */

export type AdminSourceAccountsDeps = SourceAccountDeps;

export async function adminSourceAccountsDeps(): Promise<AdminSourceAccountsDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    // Unreachable after `requireRole("ADMIN")`: the scope is built from the
    // same DB-verified session row the role came from. Throwing beats a cast.
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  return {
    sourceAccounts: new DrizzleSourceAccountRepository(getDb()),
    actorId: scope.userId,
  };
}
