import type { UserRole } from "@/modules/identity/domain/user-role";
import type { VerifiedSession } from "./session-verifier";

/**
 * 401 — there is no valid session. The caller may fix this by logging in,
 * which is why it is a distinct type: only this one justifies a redirect to
 * the login page.
 */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Unauthenticated");
    this.name = "UnauthenticatedError";
  }
}

/**
 * 403 — the session is valid but the role is wrong. Logging in again
 * changes nothing, so this must never redirect to login.
 *
 * The message is the bare word on purpose: an authorization failure that
 * names the required role, or the caller, answers questions the caller was
 * not supposed to be able to ask.
 */
export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export function requireSession(session: VerifiedSession | null): VerifiedSession {
  if (session === null) {
    throw new UnauthenticatedError();
  }
  return session;
}

/**
 * AUTH: Role-Aware Authorization. Exact match, not a hierarchy: ADMIN is
 * not "RESELLER plus more" — an admin has no price tier and no reseller id,
 * so letting it pass a RESELLER check would hand tier-scoped code a scope
 * it cannot satisfy.
 */
export function assertRole(session: VerifiedSession, role: UserRole): VerifiedSession {
  if (session.role !== role) {
    throw new ForbiddenError();
  }
  return session;
}
