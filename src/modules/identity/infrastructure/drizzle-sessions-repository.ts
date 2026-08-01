import { and, eq, isNull } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";

import type { SessionId } from "../domain/ids";
import type {
  NewSession,
  SessionRow,
  SessionsRepository,
  VerifiableSession,
} from "../domain/sessions-repository";
import { sessions, users } from "./identity.schema";


function toSessionRow(row: typeof sessions.$inferSelect): SessionRow {
  return Object.freeze({
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  });
}

/**
 * Drizzle-backed session persistence (task 5a.8). Insert only — the
 * revocation and lookup paths land with the DAL in slice 5b.
 */
export class DrizzleSessionsRepository implements SessionsRepository {
  constructor(private readonly db: ModuleDb) {}

  async create(session: NewSession): Promise<SessionRow> {
    // `revoked_at` is left to its NULL default: a session is born active.
    const [row] = await this.db.insert(sessions).values(session).returning();
    return toSessionRow(row);
  }

  async findVerifiable(sessionId: SessionId): Promise<VerifiableSession | null> {
    // The join is the point (design.md "Revocation": `verifySession`
    // re-reads session ⋈ user on every request). Reading the session alone
    // would miss a user deactivated after the session was minted.
    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        role: users.role,
        resellerId: users.resellerId,
        priceTierId: users.priceTierId,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        userDeactivatedAt: users.deactivatedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return row ? Object.freeze({ ...row }) : null;
  }

  async revoke(sessionId: SessionId, revokedAt: Date = new Date()): Promise<void> {
    // `revoked_at IS NULL` keeps the FIRST revocation timestamp: re-running
    // logout must not move the moment access was actually withdrawn.
    await this.db
      .update(sessions)
      .set({ revokedAt })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }
}
