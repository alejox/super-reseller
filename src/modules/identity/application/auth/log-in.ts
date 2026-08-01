import type { SessionId } from "@/modules/identity/domain/ids";
import type { SessionsRepository } from "@/modules/identity/domain/sessions-repository";
import {
  authenticate,
  type AuthenticateDeps,
  type AuthenticateInput,
  type AuthenticatedUser,
} from "./authenticate";
import { sessionExpiresAt, signSessionToken } from "./session-token";

export type LogInDeps = AuthenticateDeps &
  Readonly<{
    sessions: SessionsRepository;
    /** HMAC key for the session token — `sessionSecretKey()` in production. */
    signingKey: Uint8Array;
    /**
     * Session id generator. Injected rather than called inline so tests can
     * assert on the persisted row; production passes `crypto.randomUUID`
     * (design.md: "identifiers are generated in the application").
     */
    newSessionId: () => SessionId;
    now?: () => Date;
  }>;

export type LogInResult =
  | Readonly<{
      ok: true;
      user: AuthenticatedUser;
      /** Signed session token — the value the cookie carries (slice 5b sets it). */
      token: string;
      /** Mirrors the persisted `sessions.expires_at`; the cookie's `expires`. */
      expiresAt: Date;
    }>
  | Readonly<{ ok: false; reason: "invalid-credentials" }>;

/**
 * AUTH: Login Issues a DB-Backed Session. Order matters: the row is written
 * BEFORE the token is signed, so a token can never name a session that does
 * not exist. The reverse order would hand out a credential for a row that a
 * failed insert never created.
 *
 * Setting the cookie is deliberately not done here — that needs `next/headers`
 * and belongs to the Server Action in slice 5b. This function stays a pure
 * server-side use case, testable without a request.
 */
export async function logIn(deps: LogInDeps, input: AuthenticateInput): Promise<LogInResult> {
  const result = await authenticate(deps, input);
  if (!result.ok) {
    return result;
  }

  const now = deps.now?.() ?? new Date();
  const session = await deps.sessions.create({
    id: deps.newSessionId(),
    userId: result.user.id,
    createdAt: now,
    expiresAt: sessionExpiresAt(now),
  });

  const token = await signSessionToken(
    { sid: session.id, uid: result.user.id, role: result.user.role },
    session.expiresAt,
    deps.signingKey,
  );

  return { ok: true, user: result.user, token, expiresAt: session.expiresAt };
}
