// @vitest-environment node
//
// Server-only: argon2 + jose need the Node realm (see session-token.test.ts).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../../tests/support/pglite-db";
import type { Argon2Params } from "@/modules/identity/domain/password-hasher";
import { DrizzleCredentialsRepository } from "@/modules/identity/infrastructure/drizzle-credentials-repository";
import { DrizzleSessionsRepository } from "@/modules/identity/infrastructure/drizzle-sessions-repository";
import { DrizzleUserProvisioning } from "@/modules/identity/infrastructure/drizzle-user-provisioning";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { logIn } from "../auth/log-in";
import { MINIMUM_PASSWORD_LENGTH, provisionAdmin } from "./provision-admin";

/**
 * The bootstrap problem: a fresh database has no users, so nobody can log
 * in and nobody can create the first account through the UI either. This is
 * what `npm run db:seed-admin` solves.
 *
 * The final test here is the one that matters — seed, then log in with
 * those exact credentials against real Postgres. It is the first proof that
 * the whole chain (argon2 hash → stored row → constant-path verify →
 * session row → signed token) closes.
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
const PASSWORD = "una contraseña bastante larga";

let testDb: TestDb;
let hasher: NodeRsArgon2Hasher;

function deps() {
  return {
    users: new DrizzleCredentialsRepository(testDb.db),
    provisioning: new DrizzleUserProvisioning(testDb.db),
    hasher,
    newUserId: () => "55555555-5555-4555-8555-555555555555",
  };
}

beforeEach(async () => {
  testDb = await createTestDb();
  await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
  hasher = new NodeRsArgon2Hasher(TEST_PARAMS);
});

afterEach(async () => {
  await closeTestDb(testDb);
});

describe("provisionAdmin", () => {
  it("creates an ADMIN with no price tier, as users_reseller_requires_tier demands", async () => {
    const result = await provisionAdmin(deps(), { email: "Owner@Example.com", password: PASSWORD });

    expect(result).toEqual({
      ok: true,
      user: { id: "55555555-5555-4555-8555-555555555555", email: "owner@example.com" },
    });

    const rows = await testDb.db.execute<{
      email: string;
      role: string;
      price_tier_id: string | null;
      password_hash: string;
    }>(sql`SELECT email, role, price_tier_id, password_hash FROM users`);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].role).toBe("ADMIN");
    expect(rows.rows[0].price_tier_id).toBeNull();
    // Stored normalized, so the row and `users_email_lower_uniq` agree.
    expect(rows.rows[0].email).toBe("owner@example.com");
  });

  it("never stores the password itself", async () => {
    await provisionAdmin(deps(), { email: "owner@example.com", password: PASSWORD });

    const rows = await testDb.db.execute<{ password_hash: string }>(
      sql`SELECT password_hash FROM users`,
    );
    expect(rows.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(rows.rows[0].password_hash).not.toContain(PASSWORD);
  });

  it("refuses a duplicate email, case-insensitively", async () => {
    await provisionAdmin(deps(), { email: "owner@example.com", password: PASSWORD });

    const second = await provisionAdmin(deps(), {
      email: "OWNER@EXAMPLE.COM",
      password: PASSWORD,
    });

    // Caught before the insert: the functional unique index would reject it
    // anyway, but a raw constraint violation is not an answer a CLI can act on.
    expect(second).toEqual({ ok: false, reason: "email-taken" });
  });

  it("refuses a password too short to be worth hashing", async () => {
    const result = await provisionAdmin(deps(), { email: "owner@example.com", password: "corta" });

    expect(result).toEqual({ ok: false, reason: "password-too-short" });
    const rows = await testDb.db.execute(sql`SELECT id FROM users`);
    expect(rows.rows).toHaveLength(0);
  });

  // The boundary is pinned with literals, not with the constant itself: a
  // test written as `"x".repeat(MINIMUM_PASSWORD_LENGTH)` follows the
  // constant wherever it goes and would let the minimum be lowered to 1
  // without a single test turning red.
  it("accepts a password of exactly 10 characters", async () => {
    expect(MINIMUM_PASSWORD_LENGTH).toBe(10);

    const result = await provisionAdmin(deps(), {
      email: "owner@example.com",
      password: "0123456789",
    });

    expect(result.ok).toBe(true);
  });

  it("refuses a password of 9 characters", async () => {
    const result = await provisionAdmin(deps(), {
      email: "owner@example.com",
      password: "012345678",
    });

    expect(result).toEqual({ ok: false, reason: "password-too-short" });
  });

  it("SEED → LOGIN: the provisioned admin can actually log in", async () => {
    await provisionAdmin(deps(), { email: "owner@example.com", password: PASSWORD });

    const result = await logIn(
      {
        users: new DrizzleCredentialsRepository(testDb.db),
        sessions: new DrizzleSessionsRepository(testDb.db),
        hasher,
        dummyPasswordHash: await hasher.hash("dummy"),
        signingKey: KEY,
        newSessionId: () => "77777777-7777-4777-8777-777777777777",
      },
      { email: "owner@example.com", password: PASSWORD },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.role).toBe("ADMIN");
  });

  it("SEED → LOGIN: a wrong password still fails for the provisioned admin", async () => {
    await provisionAdmin(deps(), { email: "owner@example.com", password: PASSWORD });

    const result = await logIn(
      {
        users: new DrizzleCredentialsRepository(testDb.db),
        sessions: new DrizzleSessionsRepository(testDb.db),
        hasher,
        dummyPasswordHash: await hasher.hash("dummy"),
        signingKey: KEY,
        newSessionId: () => "77777777-7777-4777-8777-777777777777",
      },
      { email: "owner@example.com", password: "otra cosa completamente" },
    );

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
  });
});
