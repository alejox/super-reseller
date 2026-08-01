import type { PriceTierId, ResellerId, SessionId, UserId } from "./ids";
import type { UserRole } from "./user-role";

/**
 * A `sessions` row (AUTH: Login Issues a DB-Backed Session). No IP, no
 * user-agent — Ley 1581 data minimization (design.md "Schema").
 */
export type SessionRow = Readonly<{
  id: SessionId;
  userId: UserId;
  createdAt: Date;
  expiresAt: Date;
  /** Revocation marker; set for every active session when a user is deactivated. */
  revokedAt: Date | null;
}>;

export type NewSession = Readonly<{
  id: SessionId;
  userId: UserId;
  createdAt: Date;
  expiresAt: Date;
}>;

/**
 * Session persistence. Unscoped like `CredentialsRepository`, and for the
 * same reason: a session is what an `AccessScope` is derived FROM, so it
 * cannot itself be read through one.
 *
 * `revokedAt` is not an input to `create` — a session is born active, and
 * revocation is a separate transition (slice 5b).
 */
/**
 * The `sessions ⋈ users` join every authenticated request re-reads
 * (design.md "Revocation"). It carries the user's CURRENT role, tier and
 * deactivation state — not what the cookie claimed when it was minted,
 * which is precisely the difference between a revocable session and a
 * stateless token.
 */
export type VerifiableSession = Readonly<{
  sessionId: SessionId;
  userId: UserId;
  role: UserRole;
  resellerId: ResellerId | null;
  priceTierId: PriceTierId | null;
  expiresAt: Date;
  revokedAt: Date | null;
  userDeactivatedAt: Date | null;
}>;

/**
 * Session persistence. Unscoped like `CredentialsRepository`, and for the
 * same reason: a session is what an `AccessScope` is derived FROM, so it
 * cannot itself be read through one.
 *
 * `revokedAt` is not an input to `create` — a session is born active, and
 * revocation is a separate transition.
 */
export interface SessionsRepository {
  create(session: NewSession): Promise<SessionRow>;

  /**
   * Reads the session joined with its user. Returns the row as stored,
   * expired/revoked/deactivated included — deciding validity is the
   * verifier's job, not the repository's, so the rejection rule lives in
   * exactly one place.
   */
  findVerifiable(sessionId: SessionId): Promise<VerifiableSession | null>;

  /** Revokes one session (logout). No-op when it is already revoked. */
  revoke(sessionId: SessionId, revokedAt?: Date): Promise<void>;
}
