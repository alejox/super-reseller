"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/shared/db/client";
import { PRODUCTION_HASHER_PARAMS } from "@/modules/identity/domain/password-hasher";
import { DrizzleAccountAdministration } from "@/modules/identity/infrastructure/drizzle-account-administration";
import { DrizzleCredentialsRepository } from "@/modules/identity/infrastructure/drizzle-credentials-repository";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { deactivateUserAsAdmin } from "./admin/deactivate-user";
import { LOGIN_PATH, homeFor } from "./auth/route-access";
import { logIn } from "./auth/log-in";
import { sessionSecretKey } from "./auth/session-token";
import { SESSION_COOKIE, getScope, getSession, requireRole } from "./dal";

/**
 * Server Actions — the request-path wiring for slice 5b.
 *
 * Every action re-authorizes itself through the DAL. Server Actions are
 * public POST endpoints: an attacker can invoke one directly, without ever
 * loading the page whose button calls it, so `proxy.ts` having allowed the
 * navigation proves nothing here.
 */

export type LoginFormState = { readonly error: string } | undefined;

/**
 * A single, deliberately vague failure message. "No such user" and "wrong
 * password" are the same answer to the user and two different answers to an
 * attacker enumerating accounts — the constant-path verification in
 * `authenticate` exists to close exactly that gap, and a chattier message
 * here would reopen it.
 */
const INVALID_CREDENTIALS = "Email o contraseña incorrectos.";

/**
 * The dummy hash is computed per call rather than at module load: hashing at
 * import time would run argon2 during the build, and a module-level constant
 * would pin one hash for the whole process lifetime. The cost is the point —
 * it must match a real verify.
 */
async function dummyHash(hasher: NodeRsArgon2Hasher): Promise<string> {
  return hasher.hash(`dummy:${crypto.randomUUID()}`);
}

export async function login(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (email === "" || password === "") {
    return { error: INVALID_CREDENTIALS };
  }

  const hasher = new NodeRsArgon2Hasher(PRODUCTION_HASHER_PARAMS);
  const result = await logIn(
    {
      users: new DrizzleCredentialsRepository(getDb()),
      sessions: new DrizzleSessionsRepository(getDb()),
      hasher,
      dummyPasswordHash: await dummyHash(hasher),
      signingKey: sessionSecretKey(),
      newSessionId: () => crypto.randomUUID(),
    },
    { email, password },
  );

  if (!result.ok) {
    return { error: INVALID_CREDENTIALS };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // Mirrors `sessions.expires_at` exactly: the cookie must not outlive the
    // row it names, nor die before it.
    expires: result.expiresAt,
  });

  // AUTH: Role-Aware Home Routing — the SAME exhaustive `homeFor` the route
  // gate (`route-access.ts`) enforces on every later request.
  redirect(homeFor(result.user.role));
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session !== null) {
    // Revoke the ROW, not just the cookie. Deleting the cookie alone would
    // leave a valid session behind for anyone holding a copy of the token.
    await new DrizzleSessionsRepository(getDb()).revoke(session.sessionId);
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect(LOGIN_PATH);
}

/**
 * The representative ADMIN-only Server Action (task 5b.6). `requireRole`
 * runs first and throws before any repository is touched.
 */
export async function deactivateUserAction(userId: string): Promise<void> {
  const session = await requireRole("ADMIN");
  const scope = await getScope();

  await deactivateUserAsAdmin(
    { administration: new DrizzleAccountAdministration(getDb(), scope) },
    session,
    userId,
  );
}
