import { SignJWT, jwtVerify } from "jose";

import type { SessionId, UserId } from "@/modules/identity/domain/ids";
import { isUserRole, type UserRole } from "@/modules/identity/domain/user-role";

/**
 * Session signing (design.md "Auth and Session"). The token carries the
 * session id, not the session's authority: every authenticated request
 * still re-reads `sessions ⋈ users`, because a signature cannot know that a
 * session was revoked one microsecond ago.
 */

/** The signed claim set. Nothing secret lives here, so signing (JWS) suffices — no JWE. */
export type SessionClaims = Readonly<{
  sid: SessionId;
  uid: UserId;
  role: UserRole;
}>;

const ALGORITHM = "HS256";

/** Absolute lifetime; there is no sliding refresh in this change. */
export const SESSION_TTL_DAYS = 7;

const MINIMUM_SECRET_BYTES = 32;

/** The `sessions.expires_at` value a session issued at `issuedAt` must carry. */
export function sessionExpiresAt(issuedAt: Date = new Date()): Date {
  return new Date(issuedAt.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Reads `SESSION_SECRET` — this module is the only place that touches it.
 * Read at call time, never at module load: a module-load read would make
 * importing this file fail in any context that has no secret configured,
 * including tests that pass their own key.
 */
export function sessionSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const key = new TextEncoder().encode(secret);
  if (key.byteLength < MINIMUM_SECRET_BYTES) {
    throw new Error(`SESSION_SECRET must be at least ${MINIMUM_SECRET_BYTES} bytes`);
  }
  return key;
}

/**
 * Signs `{ sid, uid, role }` with HS256. `exp` is taken from the session
 * row's own expiry so the cookie, the token, and `sessions.expires_at` can
 * never disagree about when the session ends.
 */
export async function signSessionToken(
  claims: SessionClaims,
  expiresAt: Date,
  key: Uint8Array,
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key);
}

/**
 * Verifies a token and returns its claims, or `null` for anything that does
 * not verify — bad signature, tampered payload, expired, or a header
 * advertising another algorithm. `algorithms: ['HS256']` is the pin that
 * makes `alg: none` and HS/RS confusion unreachable; without it, a token
 * whose header says `none` would be accepted as unsigned.
 *
 * Every rejection collapses to `null` because callers can do nothing useful
 * with the distinction: an invalid session is an invalid session.
 */
export async function verifySessionToken(
  token: string,
  key: Uint8Array,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    const { sid, uid, role } = payload;
    if (typeof sid !== "string" || typeof uid !== "string" || !isUserRole(role)) {
      return null;
    }
    return { sid, uid, role };
  } catch {
    return null;
  }
}
