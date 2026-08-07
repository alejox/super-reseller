import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/shared/db/client";
import {
  mintAdminScope,
  mintCustomerScope,
  mintResellerScope,
  type AccessScope,
} from "@/modules/identity/domain/access-scope";
import type { UserId } from "@/modules/identity/domain/ids";
import type { UserRole } from "@/modules/identity/domain/user-role";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { assertRole } from "./authorization";
import { LOGIN_PATH } from "./auth/route-access";
import { sessionSecretKey } from "./auth/session-token";
import { resolveActingCustomerScopeInput, scopeInputFromSession, type ScopeInput } from "./scope-resolution";
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
 * Mints the concrete `AccessScope` for a decided `ScopeInput` — the ONLY
 * place any of the three mint functions is called. Kept a plain function
 * (not `cache()`d itself): both call sites below wrap it in their own
 * per-request cache.
 */
function mintScope(input: ScopeInput): AccessScope {
  switch (input.kind) {
    case "admin":
      return mintAdminScope(input.userId);
    case "reseller":
      return mintResellerScope(input.userId, input.resellerId, input.priceTierId);
    case "customer":
      return mintCustomerScope(
        input.userId,
        input.tenantId,
        input.priceTierId,
        input.actingAdminUserId,
      );
  }
}

/**
 * Mints the `AccessScope` for the current request — the single production
 * bridge between "who is asking" and "what SQL may run". The scope is built
 * from the DB row, never from the cookie, so a tampered or stale cookie
 * cannot widen it. The branching decision itself lives in
 * `scopeInputFromSession` (application/scope-resolution.ts), unit-tested
 * independently of this `"server-only"` file.
 */
export const getScope = cache(async (): Promise<AccessScope> => {
  const session = await verifySession();
  return mintScope(scopeInputFromSession(session));
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

/**
 * design.md "Decision: ADMIN-acting-as-customer is a scope downgrade, not a
 * wider admin scope". The only other scope minter besides `getScope`: it
 * re-verifies the session row is `ADMIN`, loads the target from the DB,
 * and mints a scope for the TARGET's tenant — narrower than an admin
 * scope, not wider. `resolveActingCustomerScopeInput` (scope-resolution.ts)
 * owns the validation (real target, `role === "CUSTOMER"`,
 * `deactivated_at IS NULL`) and is unit-tested independently of this file.
 */
export const actAsCustomer = cache(async (targetUserId: UserId): Promise<AccessScope> => {
  const session = await requireRole("ADMIN");
  const admin = mintAdminScope(session.userId);
  const targets = await new DrizzleScopedUsersRepository(getDb(), admin).listUsers();
  const target = targets.find((user) => user.id === targetUserId) ?? null;
  return mintScope(resolveActingCustomerScopeInput(session.userId, target));
});
