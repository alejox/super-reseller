import "server-only";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import type { TopUpSettingsRepository } from "@/modules/wallet/domain/top-up-settings-repository";
import { DrizzleTopUpSettingsRepository } from "@/modules/wallet/infrastructure/drizzle-top-up-settings-repository";
import type { ScopedUsersRepository } from "@/modules/identity/domain/scoped-users-repository";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import { getDb } from "@/shared/db/client";

/**
 * The top-up limits screen's composition root.
 *
 * `requireRole("ADMIN")` is doing real work here, not ceremony:
 * `topup_settings` has no `reseller_id`, so it is the one table in the wallet
 * module that `tenantWhere` cannot guard. This function IS the guard.
 */

export type AdminTopUpSettingsDeps = Readonly<{
  topUpSettings: TopUpSettingsRepository;
  /** To show WHO last changed the limits, not just when. */
  users: ScopedUsersRepository;
  actorId: string;
}>;

export async function adminTopUpSettingsDeps(): Promise<AdminTopUpSettingsDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  const db = getDb();
  return {
    topUpSettings: new DrizzleTopUpSettingsRepository(db),
    users: new DrizzleScopedUsersRepository(db, scope),
    actorId: scope.userId,
  };
}
