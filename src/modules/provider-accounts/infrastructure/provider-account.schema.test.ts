import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createTestDb, closeTestDb, type TestDb } from "../../../../tests/support/pglite-db";

/**
 * PA: Provider Account Identifies A Real Panel Login / PA: No Credential Or
 * Lifecycle Fields Exist — proven at the SCHEMA level against real Postgres
 * (PGlite), mirroring identity.schema.test.ts's approach.
 *
 * Task 2.1 RED: this file is written and run BEFORE `drizzle/0008_provider_
 * account.sql` and `provider-account.schema.ts` exist, so `migrate()` never
 * creates the table and every assertion below fails. It stays the driver for
 * the migration (2.2), the down file (2.3), and the schema module (2.4).
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

async function columnsOf(testDb: TestDb, tableName: string): Promise<string[]> {
  const result = await testDb.db.execute<{ column_name: string }>(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} ORDER BY column_name`,
  );
  return result.rows.map((row) => row.column_name);
}

describe("provider_account schema (PA: Provider Account Identifies A Real Panel Login)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("creates the provider_account table with the provider, real panel identifier, and label columns", async () => {
    const columns = await columnsOf(testDb, "provider_account");

    expect(columns).toEqual([
      "archived_at",
      "created_at",
      "created_by",
      "id",
      "label",
      "panel_username",
      "reseller_id",
      "service_id",
    ]);
  });

  it("declares provider_account_panel_username_check rejecting a blank panel username", async () => {
    const result = await testDb.db.execute<{ conname: string }>(
      sql`SELECT conname FROM pg_constraint WHERE conname = 'provider_account_panel_username_check'`,
    );

    expect(result.rows).toHaveLength(1);
  });

  it("declares the partial unique index allowing duplicate providers, not duplicate identities", async () => {
    const result = await testDb.db.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes WHERE tablename = 'provider_account' AND indexname = 'provider_account_identity_uniq'`,
    );

    expect(result.rows).toHaveLength(1);
  });
});

describe("provider_account schema (PA: No Credential Or Lifecycle Fields Exist — tripwire)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("exposes no credential, secret, password, token, or expiry-shaped column", async () => {
    const columns = await columnsOf(testDb, "provider_account");

    // Guards against a vacuous pass: an empty column set (the table missing
    // entirely) would trivially satisfy "no column matches", same shape as
    // shared/db/schema.inspection.test.ts's "not vacuous" guard.
    expect(columns.length).toBeGreaterThan(0);

    const forbiddenColumnPattern = /pass|secret|credential|token|expir/i;
    for (const column of columns) {
      expect(column).not.toMatch(forbiddenColumnPattern);
    }
  });
});
