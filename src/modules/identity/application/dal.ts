import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/shared/db/client";
import {
  mintAdminScope,
  mintResellerScope,
  type AccessScope,
} from "@/modules/identity/domain/access-scope";
import type { UserRole } from "@/modules/identity/domain/user-role";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { assertRole } from "./authorization";
import { LOGIN_PATH } from "./auth/route-access";
import { sessionSecretKey } from "./auth/session-token";
import { verifySessionFromToken, type VerifiedSession } from "./session-verifier";

/**
 * The Data Access Layer (AUTH: Data Access Layer Enforces Authorization).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS FILE MUST NEVER USE `"use cache"`.
 * ─────────────────────────────────────────────────────────────────────────
 * React's `cache()` — used below — memoizes PER REQUEST: the same render
 * pass reuses one `sessions ⋈ users` read instead of issuing four. Next 16's
 * `"use cache"` directive is a different thing entirely: it is cross-request
 * and durable. Applying it here would serve one user's verified session to
 * another request, and would keep a REVOKED session alive for the whole
 * cache lifetime — defeating the only reason sessions are DB-backed at all
 * (design.md: "the single most dangerous Next 16 footgun in this design").
 *
 * The functions below are the ONLY sanctioned minters of `AccessScope` in
 * production code; eslint.config.mjs enforces that by path.
 */

export const SESSION_COOKIE = "session";

const deps = () => ({
  sessions: new DrizzleSessionsRepository(getDb()),
  signingKey: sessionSecretKey(),
});

/**
 * Reads the session cookie and re-verifies it against the database. Per
 * request, not per application: `cache()` dedupes within one render pass
 * and is discarded when the request ends.
 */
export const getSession = cache(async (): Promise<VerifiedSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionFromToken(deps(), token);
});

/**
 * The session, or a redirect to the login page. Use this in pages; use
 * `getSession` where a missing session is a legitimate outcome (a public
 * page that merely greets a signed-in visitor).
 */
export const verifySession = cache(async (): Promise<VerifiedSession> => {
  const session = await getSession();
  if (session === null) {
    redirect(LOGIN_PATH);
  }
  return session;
});

/**
 * Mints the `AccessScope` for the current request — the single production
 * bridge between "who is asking" and "what SQL may run". The scope is built
 * from the DB row, never from the cookie, so a tampered or stale cookie
 * cannot widen it.
 */
export const getScope = cache(async (): Promise<AccessScope> => {
  const session = await verifySession();

  if (session.role === "ADMIN") {
    return mintAdminScope(session.userId);
  }

  // The schema's `users_reseller_requires_tier` CHECK makes a tier-less
  // RESELLER unrepresentable, so this can only fire if the row was written
  // around the constraint. Failing loudly beats minting a scope with a
  // missing tier, which would silently widen a reseller's catalog.
  if (session.resellerId === null || session.priceTierId === null) {
    throw new Error(`RESELLER ${session.userId} has no reseller id or price tier`);
  }

  return mintResellerScope(session.userId, session.resellerId, session.priceTierId);
});

/**
 * AUTH: Role-Aware Authorization, at the request boundary. Every Server
 * Action calls this itself — Server Actions are public POST endpoints, so
 * the fact that the page rendering the button was gated proves nothing
 * about the request that reaches the action.
 */
export const requireRole = cache(async (role: UserRole): Promise<VerifiedSession> => {
  return assertRole(await verifySession(), role);
});
