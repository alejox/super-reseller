import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import { tenantWhere } from "@/shared/db/tenant";
import type { AccessScope } from "../domain/access-scope";
import type { UserId } from "../domain/ids";
import type { ScopedUserRow, ScopedUsersRepository } from "../domain/scoped-users-repository";
import { users } from "./identity.schema";

/**
 * Runs unmodified against both `NeonHttpDatabase` (production) and
 * `PgliteDatabase` (tests) — same pattern as the catalog adapter's
 * `CatalogDb` union.
 */
type IdentityDb = NeonHttpDatabase | PgliteDatabase;

function toScopedUserRow(row: typeof users.$inferSelect): ScopedUserRow {
  return Object.freeze({
    id: row.id,
    email: row.email,
    role: row.role,
    resellerId: row.resellerId,
    deactivatedAt: row.deactivatedAt,
  });
}

/**
 * Drizzle-backed scoped identity read adapter (task 4.9). EVERY read path
 * is forced through `tenantWhere(users, scope)`: ADMIN scope → no reseller
 * predicate (every row); RESELLER scope → `reseller_id = scope.resellerId`
 * (own rows only, IT: Reseller Row Isolation). Omitting the predicate is
 * not expressible: the scope is consumed at construction and `tenantWhere`
 * is the only where-clause builder in the read path.
 */
export class DrizzleScopedUsersRepository implements ScopedUsersRepository {
  constructor(
    private readonly db: IdentityDb,
    private readonly scope: AccessScope,
  ) {}

  async listUsers(): Promise<readonly ScopedUserRow[]> {
    const rows = await this.db.select().from(users).where(tenantWhere(users, this.scope));
    return rows.map(toScopedUserRow);
  }

  async deactivateUser(userId: UserId): Promise<ScopedUserRow | null> {
    // IT: Reseller Deactivation Preserves Data — soft delete only: sets
    // `deactivated_at`, never removes the row. The UPDATE is isolated like
    // the reads: `tenantWhere` applies to the write path, so a RESELLER
    // scope cannot deactivate a row it does not own (`and()` composes the
    // scope predicate with the row predicate; for an ADMIN scope
    // `tenantWhere` is `undefined` and `and()` drops it).
    const [row] = await this.db
      .update(users)
      .set({ deactivatedAt: new Date() })
      .where(and(tenantWhere(users, this.scope), eq(users.id, userId)))
      .returning();
    return row ? toScopedUserRow(row) : null;
  }
}
