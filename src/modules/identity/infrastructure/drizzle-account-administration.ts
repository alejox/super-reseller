import { sql } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";

import type { AccessScope } from "../domain/access-scope";
import type {
  AccountAdministration,
  DeactivationOutcome,
} from "../domain/account-administration";
import type { UserId } from "../domain/ids";
import { isUserRole } from "../domain/user-role";


// Intersected with an index signature to satisfy `execute<T extends
// Record<string, unknown>>`, while keeping the columns actually selected
// typed rather than `unknown`.
type DeactivationRow = {
  id: string;
  email: string;
  role: string;
  reseller_id: string | null;
  deactivated_at: string | Date;
  revoked_sessions: number;
} & Record<string, unknown>;

/**
 * AUTH: Deactivation Revokes Sessions, as ONE statement.
 *
 * design.md calls for a transaction, and a transaction is what this is —
 * but expressed as data-modifying CTEs rather than a client-side
 * `db.transaction()`. That is not a stylistic choice: the production driver
 * is `@neondatabase/serverless` over HTTP, and drizzle's neon-http session
 * throws "No transactions support in neon-http driver" (verified in
 * node_modules/drizzle-orm/neon-http/session.js). A single statement is
 * atomic on EVERY driver — Neon HTTP, Neon WebSocket, PGlite — so the
 * guarantee holds without pinning the deployment to one connection mode.
 *
 * Postgres executes data-modifying CTEs exactly once and to completion, and
 * both writes see the same snapshot, so the user cannot end up soft-deleted
 * with live sessions still attached.
 */
export class DrizzleAccountAdministration implements AccountAdministration {
  constructor(
    private readonly db: ModuleDb,
    private readonly scope: AccessScope,
  ) {}

  async deactivateUserAndRevokeSessions(userId: UserId): Promise<DeactivationOutcome | null> {
    const now = new Date();
    // Same isolation rule as `tenantWhere`: an ADMIN scope matches any row,
    // a RESELLER scope only its own. Written inline because this is one raw
    // statement, not a query builder chain.
    const scope = this.scope;
    const tenantPredicate =
      scope.kind === "admin" ? sql`TRUE` : sql`reseller_id = ${scope.resellerId}`;

    const result = await this.db.execute<DeactivationRow>(sql`
      WITH deactivated AS (
        UPDATE users SET deactivated_at = ${now.toISOString()}
        WHERE id = ${userId} AND ${tenantPredicate}
        RETURNING id, email, role, reseller_id, deactivated_at
      ), revoked AS (
        UPDATE sessions SET revoked_at = ${now.toISOString()}
        WHERE user_id IN (SELECT id FROM deactivated) AND revoked_at IS NULL
        RETURNING id
      )
      SELECT d.id, d.email, d.role, d.reseller_id, d.deactivated_at,
             (SELECT count(*) FROM revoked)::int AS revoked_sessions
      FROM deactivated d
    `);

    const row = result.rows[0];
    if (!row) return null;
    if (!isUserRole(row.role)) {
      throw new Error(`Unexpected role "${row.role}" in users row ${row.id}`);
    }

    return Object.freeze({
      user: Object.freeze({
        id: row.id,
        email: row.email,
        role: row.role,
        resellerId: row.reseller_id,
        deactivatedAt: new Date(row.deactivated_at),
      }),
      revokedSessions: Number(row.revoked_sessions),
    });
  }
}
