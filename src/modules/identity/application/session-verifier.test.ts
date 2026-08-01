// @vitest-environment node
//
// Server-only: jose needs the Node realm (see session-token.test.ts).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { mintAdminScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import { DrizzleAccountAdministration } from "@/modules/identity/infrastructure/drizzle-account-administration";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { signSessionToken } from "./auth/session-token";
import { verifySessionFromToken } from "./session-verifier";

/**
 * AUTH: Data Access Layer Enforces Authorization — the DAL must return an
 * authorization failure rather than data whenever the session context is
 * not valid. This suite is that check at its core: `verifySessionFromToken`
 * is what `dal.ts` calls, and it re-reads `sessions ⋈ users` on EVERY call
 * (design.md "Revocation"), which is the only reason a revoked session can
 * be rejected at all.
 */

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
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
const RESELLER_SESSION = "88888888-8888-4888-8888-888888888888";

const FAR_FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

let testDb: TestDb;

function deps() {
  return { sessions: new DrizzleSessionsRepository(testDb.db), signingKey: KEY };
}

async function insertSession(id: string, userId: string, expiresAt: Date): Promise<void> {
  await testDb.db.execute(
    sql`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (${id}, ${userId}, now(), ${expiresAt.toISOString()})`,
  );
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
  await insertSession(ADMIN_SESSION, ADMIN_ID, FAR_FUTURE);
  await insertSession(RESELLER_SESSION, RESELLER_ID, FAR_FUTURE);
});

afterEach(async () => {
  await closeTestDb(testDb);
});

describe("verifySessionFromToken (AUTH: Data Access Layer Enforces Authorization)", () => {
  it("returns null when there is no token at all", async () => {
    await expect(verifySessionFromToken(deps(), undefined)).resolves.toBeNull();
  });

  it("returns null for a token that does not verify", async () => {
    await expect(verifySessionFromToken(deps(), "not.a.token")).resolves.toBeNull();
  });

  it("returns the session for a valid ADMIN token", async () => {
    const token = await signSessionToken(
      { sid: ADMIN_SESSION, uid: ADMIN_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );

    await expect(verifySessionFromToken(deps(), token)).resolves.toEqual({
      sessionId: ADMIN_SESSION,
      userId: ADMIN_ID,
      role: "ADMIN",
      resellerId: null,
      priceTierId: null,
    });
  });

  it("carries the reseller's own id and tier, read from the row and not from the token", async () => {
    const token = await signSessionToken(
      { sid: RESELLER_SESSION, uid: RESELLER_ID, role: "RESELLER" },
      FAR_FUTURE,
      KEY,
    );

    await expect(verifySessionFromToken(deps(), token)).resolves.toEqual({
      sessionId: RESELLER_SESSION,
      userId: RESELLER_ID,
      role: "RESELLER",
      resellerId: RESELLER_ID,
      priceTierId: TIER_ID,
    });
  });

  it("returns null when the signed session id has no row", async () => {
    const token = await signSessionToken(
      { sid: "deadbeef-dead-4ead-8ead-deaddeaddead", uid: ADMIN_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );

    await expect(verifySessionFromToken(deps(), token)).resolves.toBeNull();
  });

  it("returns null when the ROW is expired even though the token still verifies", async () => {
    // The row is the authority. A token minted with a longer life than its
    // session row must not outlive the row.
    await testDb.db.execute(
      sql`UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE id = ${ADMIN_SESSION}`,
    );
    const token = await signSessionToken(
      { sid: ADMIN_SESSION, uid: ADMIN_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );

    await expect(verifySessionFromToken(deps(), token)).resolves.toBeNull();
  });

  it("returns null for a revoked session", async () => {
    await testDb.db.execute(
      sql`UPDATE sessions SET revoked_at = now() WHERE id = ${ADMIN_SESSION}`,
    );
    const token = await signSessionToken(
      { sid: ADMIN_SESSION, uid: ADMIN_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );

    await expect(verifySessionFromToken(deps(), token)).resolves.toBeNull();
  });

  it("returns null when the token's uid disagrees with the row's user", async () => {
    const token = await signSessionToken(
      { sid: ADMIN_SESSION, uid: RESELLER_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );

    await expect(verifySessionFromToken(deps(), token)).resolves.toBeNull();
  });

  it("takes the role from the row, so a stale role claim cannot escalate", async () => {
    // A RESELLER's own session, re-signed with role: "ADMIN". The signature
    // is valid — the claim is not.
    const token = await signSessionToken(
      { sid: RESELLER_SESSION, uid: RESELLER_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );

    const verified = await verifySessionFromToken(deps(), token);

    expect(verified?.role).toBe("RESELLER");
  });
});

describe("deactivation revokes sessions (AUTH: Deactivation Revokes Sessions)", () => {
  it("rejects the next request carrying the deactivated user's cookie", async () => {
    const token = await signSessionToken(
      { sid: RESELLER_SESSION, uid: RESELLER_ID, role: "RESELLER" },
      FAR_FUTURE,
      KEY,
    );
    // The session works before the deactivation — otherwise the assertion
    // below would pass for the wrong reason.
    expect(await verifySessionFromToken(deps(), token)).not.toBeNull();

    const admin = new DrizzleAccountAdministration(testDb.db, mintAdminScope(ADMIN_ID));
    const outcome = await admin.deactivateUserAndRevokeSessions(RESELLER_ID);

    expect(outcome).not.toBeNull();
    expect(outcome!.revokedSessions).toBe(1);
    expect(outcome!.user.deactivatedAt).not.toBeNull();

    await expect(verifySessionFromToken(deps(), token)).resolves.toBeNull();
  });

  it("revokes every active session of that user, and no one else's", async () => {
    const second = "66666666-6666-4666-8666-666666666666";
    await insertSession(second, RESELLER_ID, FAR_FUTURE);

    const admin = new DrizzleAccountAdministration(testDb.db, mintAdminScope(ADMIN_ID));
    const outcome = await admin.deactivateUserAndRevokeSessions(RESELLER_ID);

    expect(outcome!.revokedSessions).toBe(2);

    // The ADMIN's own session is untouched.
    const adminToken = await signSessionToken(
      { sid: ADMIN_SESSION, uid: ADMIN_ID, role: "ADMIN" },
      FAR_FUTURE,
      KEY,
    );
    expect(await verifySessionFromToken(deps(), adminToken)).not.toBeNull();
  });

  it("a RESELLER scope cannot deactivate a user it does not own", async () => {
    const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const outsider = new DrizzleAccountAdministration(
      testDb.db,
      mintResellerScope(other, other, TIER_ID),
    );

    await expect(outsider.deactivateUserAndRevokeSessions(RESELLER_ID)).resolves.toBeNull();

    // The victim's session still verifies — nothing was revoked.
    const token = await signSessionToken(
      { sid: RESELLER_SESSION, uid: RESELLER_ID, role: "RESELLER" },
      FAR_FUTURE,
      KEY,
    );
    expect(await verifySessionFromToken(deps(), token)).not.toBeNull();
  });

  it("deactivating an unknown user is a no-op returning null", async () => {
    const admin = new DrizzleAccountAdministration(testDb.db, mintAdminScope(ADMIN_ID));

    await expect(
      admin.deactivateUserAndRevokeSessions("deadbeef-dead-4ead-8ead-deaddeaddead"),
    ).resolves.toBeNull();
  });
});
