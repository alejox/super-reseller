// @vitest-environment node
//
// Server-only: jose needs the Node realm (see session-token.test.ts).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../../tests/support/pglite-db";
import { mintAdminScope } from "@/modules/identity/domain/access-scope";
import { DrizzleAccountAdministration } from "@/modules/identity/infrastructure/drizzle-account-administration";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { ForbiddenError, UnauthenticatedError } from "../authorization";
import { decideRouteAccess } from "../auth/route-access";
import { signSessionToken, verifySessionToken } from "../auth/session-token";
import { verifySessionFromToken } from "../session-verifier";
import type { VerifiedSession } from "../session-verifier";
import { deactivateUserAsAdmin } from "./deactivate-user";

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const KEY = new TextEncoder().encode("test-secret-at-least-32-bytes-long!!");
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const RESELLER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TIER_ID = "99999999-9999-4999-8999-999999999999";
const ADMIN_SESSION = "77777777-7777-4777-8777-777777777777";
const FAR_FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const ADMIN_CONTEXT: VerifiedSession = {
  sessionId: ADMIN_SESSION,
  userId: ADMIN_ID,
  role: "ADMIN",
  resellerId: null,
  priceTierId: null,
};

const RESELLER_CONTEXT: VerifiedSession = {
  sessionId: "88888888-8888-4888-8888-888888888888",
  userId: RESELLER_ID,
  role: "RESELLER",
  resellerId: RESELLER_ID,
  priceTierId: TIER_ID,
};

let testDb: TestDb;

function adminDeps() {
  return {
    administration: new DrizzleAccountAdministration(testDb.db, mintAdminScope(ADMIN_ID)),
  };
}

async function isDeactivated(userId: string): Promise<boolean> {
  const result = await testDb.db.execute<{ deactivated_at: string | null }>(
    sql`SELECT deactivated_at FROM users WHERE id = ${userId}`,
  );
  return result.rows[0].deactivated_at !== null;
}

beforeEach(async () => {
  testDb = await createTestDb();
  await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
  await testDb.db.execute(
    sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${TIER_ID}, 'SEED', 'Seed tier', now())`,
  );
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at)
        VALUES (${ADMIN_ID}, 'owner@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
  );
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at)
        VALUES (${RESELLER_ID}, 'reseller@example.com', '$argon2id$stand-in', 'RESELLER', ${RESELLER_ID}, ${TIER_ID}, now())`,
  );
  await testDb.db.execute(
    sql`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (${ADMIN_SESSION}, ${ADMIN_ID}, now(), ${FAR_FUTURE.toISOString()})`,
  );
});

afterEach(async () => {
  await closeTestDb(testDb);
});

describe("deactivateUserAsAdmin (AUTH: Role-Aware Authorization)", () => {
  it("lets an ADMIN deactivate a reseller", async () => {
    const outcome = await deactivateUserAsAdmin(adminDeps(), ADMIN_CONTEXT, RESELLER_ID);

    expect(outcome).not.toBeNull();
    expect(outcome!.user.id).toBe(RESELLER_ID);
    expect(await isDeactivated(RESELLER_ID)).toBe(true);
  });

  it("denies a RESELLER, and writes NOTHING", async () => {
    await expect(
      deactivateUserAsAdmin(adminDeps(), RESELLER_CONTEXT, ADMIN_ID),
    ).rejects.toThrow(ForbiddenError);

    // The denial has to happen BEFORE the write, not be undone after it.
    expect(await isDeactivated(ADMIN_ID)).toBe(false);
  });

  it("rejects an absent session as unauthenticated, not forbidden", async () => {
    await expect(deactivateUserAsAdmin(adminDeps(), null, RESELLER_ID)).rejects.toThrow(
      UnauthenticatedError,
    );
  });
});

describe("AUTH: Proxy Performs an Optimistic Check Only", () => {
  it("re-verifies a request the proxy already let through, and rejects a revoked session", async () => {
    // An ADMIN cookie that is perfectly signed. The session behind it is
    // revoked — something the proxy cannot possibly know, since it never
    // touches the database.
    const token = await signSessionToken(
      { sid: ADMIN_SESSION, uid: ADMIN_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );
    await testDb.db.execute(
      sql`UPDATE sessions SET revoked_at = now() WHERE id = ${ADMIN_SESSION}`,
    );

    // 1. The proxy's optimistic check passes — this is the accepted,
    //    documented property, not a bug.
    const claims = await verifySessionToken(token, KEY);
    expect(decideRouteAccess("/admin/users", claims)).toEqual({ kind: "allow" });

    // 2. The Server Action re-verifies against the database anyway, and the
    //    request dies there.
    const session = await verifySessionFromToken(
      { sessions: new DrizzleSessionsRepository(testDb.db), signingKey: KEY },
      token,
    );
    expect(session).toBeNull();

    await expect(deactivateUserAsAdmin(adminDeps(), session, RESELLER_ID)).rejects.toThrow(
      UnauthenticatedError,
    );
    expect(await isDeactivated(RESELLER_ID)).toBe(false);
  });
});
