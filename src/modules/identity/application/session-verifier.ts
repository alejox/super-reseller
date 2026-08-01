import type { PriceTierId, ResellerId, SessionId, UserId } from "@/modules/identity/domain/ids";
import type { SessionsRepository } from "@/modules/identity/domain/sessions-repository";
import type { UserRole } from "@/modules/identity/domain/user-role";
import { verifySessionToken } from "./auth/session-token";

/**
 * What a verified request knows about its caller. Everything here comes
 * from the `sessions ⋈ users` row, never from the cookie: the cookie proves
 * WHICH session is being presented, the row decides what that session may
 * still do.
 */
export type VerifiedSession = Readonly<{
  sessionId: SessionId;
  userId: UserId;
  role: UserRole;
  resellerId: ResellerId | null;
  priceTierId: PriceTierId | null;
}>;

export type SessionVerifierDeps = Readonly<{
  sessions: SessionsRepository;
  signingKey: Uint8Array;
  now?: () => Date;
}>;

/**
 * AUTH: Data Access Layer Enforces Authorization. Two independent gates:
 * the signature must verify, AND the live row must still be valid. Passing
 * the first alone is worthless — that is exactly the state a revoked
 * session is in.
 *
 * Returns `null` for every failure. There is no partial success and no
 * distinction worth exposing: an invalid session is an invalid session.
 */
export async function verifySessionFromToken(
  deps: SessionVerifierDeps,
  token: string | undefined,
): Promise<VerifiedSession | null> {
  if (!token) return null;

  const claims = await verifySessionToken(token, deps.signingKey);
  if (claims === null) return null;

  const row = await deps.sessions.findVerifiable(claims.sid);
  if (row === null) return null;

  // The cookie names a session that belongs to a different user: either a
  // forgery attempt or a token minted against a since-recycled id. Neither
  // is a request worth serving.
  if (row.userId !== claims.uid) return null;

  const now = deps.now?.() ?? new Date();
  if (row.revokedAt !== null) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  if (row.userDeactivatedAt !== null) return null;

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    // Deliberately the ROW's role, not `claims.role`: a token signed before
    // a demotion still carries the old role, and honoring it would let a
    // stale cookie keep privileges the database has already taken away.
    role: row.role,
    resellerId: row.resellerId,
    priceTierId: row.priceTierId,
  };
}
