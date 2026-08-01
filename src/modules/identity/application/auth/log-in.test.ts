// @vitest-environment node
//
// Server-only integration: real argon2id (reduced parameters), real jose,
// real Postgres (PGlite) with the real migrations. Node realm for the same
// reason as session-token.test.ts — jsdom's TextEncoder crosses realms and
// jose rejects the result.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../../tests/support/pglite-db";
import type { Argon2Params } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { DrizzleCredentialsRepository } from "@/modules/identity/infrastructure/drizzle-credentials-repository";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { logIn } from "./log-in";
import { SESSION_TTL_DAYS, verifySessionToken } from "./session-token";

/**
 * AUTH: Login Issues a DB-Backed Session — "a session row is persisted".
 * The row is the point: a stateless token could not be revoked when an
 * ADMIN deactivates the user (design.md "Revocation"), which is exactly
 * what slice 5b builds on top of this row.
 */

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const TEST_PARAMS: Argon2Params = {
  memoryCost: 64,
  timeCost: 1,
  parallelism: 1,
  outputLen: 32,
};

const KEY = new TextEncoder().encode("test-secret-at-least-32-bytes-long!!");
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "77777777-7777-4777-8777-777777777777";
const PASSWORD = "correct horse battery staple";

let testDb: TestDb;
let hasher: NodeRsArgon2Hasher;
let dummyPasswordHash: string;

async function countSessions(): Promise<number> {
  const result = await testDb.db.execute<{ count: string }>(
    sql`SELECT count(*)::text AS count FROM sessions`,
  );
  return Number(result.rows[0].count);
}

function makeDeps() {
  return {
    users: new DrizzleCredentialsRepository(testDb.db),
    sessions: new DrizzleSessionsRepository(testDb.db),
    hasher,
    dummyPasswordHash,
    signingKey: KEY,
    newSessionId: () => SESSION_ID,
  };
}

beforeEach(async () => {
  testDb = await createTestDb();
  await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
  hasher = new NodeRsArgon2Hasher(TEST_PARAMS);
  dummyPasswordHash = await hasher.hash("an unguessable dummy password");
  // ADMIN, so `users_reseller_requires_tier` is satisfied with no tier row.
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at)
        VALUES (${ADMIN_ID}, 'Owner@Example.com', ${await hasher.hash(PASSWORD)}, 'ADMIN', NULL, NULL, now())`,
  );
});

afterEach(async () => {
  await closeTestDb(testDb);
});

describe("logIn (AUTH: Login Issues a DB-Backed Session)", () => {
  it("persists a sessions row and returns a token that verifies to it", async () => {
    const before = Date.now();

    const result = await logIn(makeDeps(), { email: "owner@example.com", password: PASSWORD });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rows = await testDb.db.execute<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(sql`SELECT id, user_id, expires_at, revoked_at FROM sessions`);
    expect(rows.rows).toHaveLength(1);
    const [row] = rows.rows;
    expect(row.id).toBe(SESSION_ID);
    expect(row.user_id).toBe(ADMIN_ID);
    expect(row.revoked_at).toBeNull();

    // Absolute 7-day expiry, and the token's exp mirrors the row's.
    const ttlMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(new Date(row.expires_at).getTime()).toBeGreaterThanOrEqual(before + ttlMs - 5_000);
    expect(result.expiresAt.getTime()).toBe(new Date(row.expires_at).getTime());

    await expect(verifySessionToken(result.token, KEY)).resolves.toEqual({
      sid: SESSION_ID,
      uid: ADMIN_ID,
      role: "ADMIN",
    });
  });

  it("finds the user case-insensitively, matching users_email_lower_uniq", async () => {
    // The seeded row is stored as "Owner@Example.com".
    const result = await logIn(makeDeps(), { email: "OWNER@EXAMPLE.COM", password: PASSWORD });

    expect(result.ok).toBe(true);
    expect(await countSessions()).toBe(1);
  });

  it("persists no session when the password is wrong", async () => {
    const result = await logIn(makeDeps(), {
      email: "owner@example.com",
      password: "wrong password",
    });

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await countSessions()).toBe(0);
  });

  it("persists no session for an unknown email", async () => {
    const result = await logIn(makeDeps(), { email: "nobody@example.com", password: PASSWORD });

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await countSessions()).toBe(0);
  });

  it("persists no session for a deactivated user", async () => {
    await testDb.db.execute(sql`UPDATE users SET deactivated_at = now() WHERE id = ${ADMIN_ID}`);

    const result = await logIn(makeDeps(), { email: "owner@example.com", password: PASSWORD });

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await countSessions()).toBe(0);
  });
});
