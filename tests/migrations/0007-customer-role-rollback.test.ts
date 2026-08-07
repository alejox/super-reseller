import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createTestDb, closeTestDb, type TestDb } from "../support/pglite-db";
import { rollbackLast } from "@/shared/db/migrator";

/**
 * design.md task 1.3: "0007 down migration raises when a role='CUSTOMER'
 * row exists; on an empty table it restores the enum + both original
 * CHECKs." One statement (a DO block), as every hand-authored down file
 * must be (src/shared/db/migrator.ts runs it as a single prepared
 * statement).
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

const TIER_ID = "99999999-9999-4999-8999-999999999999";

async function insertUser(
  testDb: TestDb,
  id: string,
  email: string,
  role: string,
): Promise<void> {
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, price_tier_id, created_at) VALUES (${id}, ${email}, '$argon2id$stand-in', ${role}, ${TIER_ID}, now())`,
  );
}

describe("0007_customer_role down migration", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
    await testDb.db.execute(
      sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${TIER_ID}, 'SEED', 'Seed tier', now())`,
    );
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("raises and leaves the schema untouched when a CUSTOMER row exists", async () => {
    await insertUser(testDb, "11111111-1111-4111-8111-111111111111", "cust@example.com", "CUSTOMER");

    // 0009_customer_orders and 0008_provider_account sit on top and must
    // come off first before 0007 is even reachable. Neither references a
    // CUSTOMER row on the users table, so both roll back unconditionally.
    expect(await rollbackLast(testDb.db, DRIZZLE_DIR)).toBe("0009_customer_orders");
    expect(await rollbackLast(testDb.db, DRIZZLE_DIR)).toBe("0008_provider_account");

    await expect(rollbackLast(testDb.db, DRIZZLE_DIR)).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringMatching(/Cannot roll back 0007_customer_role/),
      }),
    });

    // The failed rollback must not have partially applied: role is still text.
    const stillText = await testDb.db.execute<{ udt_name: string }>(
      sql`SELECT udt_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`,
    );
    expect(stillText.rows[0]?.udt_name).toBe("text");
  });

  it("restores the enum and both original CHECKs when the table has no CUSTOMER row", async () => {
    await insertUser(testDb, "22222222-2222-4222-8222-222222222222", "reseller@example.com", "RESELLER");

    // 0009_customer_orders and 0008_provider_account sit on top of 0007 and
    // must come off first — neither references a CUSTOMER row on the users
    // table, so both roll back unconditionally.
    expect(await rollbackLast(testDb.db, DRIZZLE_DIR)).toBe("0009_customer_orders");
    expect(await rollbackLast(testDb.db, DRIZZLE_DIR)).toBe("0008_provider_account");

    const tag = await rollbackLast(testDb.db, DRIZZLE_DIR);
    expect(tag).toBe("0007_customer_role");

    const enumBack = await testDb.db.execute<{ exists: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') AS exists`,
    );
    expect(enumBack.rows[0]?.exists).toBe(true);

    const constraints = await testDb.db.execute<{ conname: string }>(
      sql`SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c' ORDER BY conname`,
    );
    expect(constraints.rows.map((row) => row.conname)).toEqual([
      "users_reseller_requires_tier",
      "users_role_check",
    ]);

    // The pre-existing RESELLER row survived the round trip.
    const survivors = await testDb.db.execute<{ role: string }>(
      sql`SELECT role FROM users WHERE id = '22222222-2222-4222-8222-222222222222'`,
    );
    expect(survivors.rows).toEqual([{ role: "RESELLER" }]);
  });
});
