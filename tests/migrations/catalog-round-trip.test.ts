import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";

import { createTestDb, closeTestDb, type TestDb } from "../support/pglite-db";
import { rollbackAll } from "@/shared/db/migrator";

/**
 * Proves the REAL catalog migration (drizzle/0000_catalog_schema.sql) and
 * its hand-authored down migration
 * (drizzle/down/0000_catalog_schema.down.sql) apply and roll back cleanly
 * against real Postgres (PGlite), matching the slice 2 round-trip pattern
 * — see tests/migrations/round-trip.test.ts, which proves the mechanism
 * with throwaway fixtures; this proves it for the actual product schema.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

async function publicTableNames(testDb: TestDb): Promise<string[]> {
  const result = await testDb.db.execute<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

describe("catalog migration round trip (apply then rollback all)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("applies the catalog migration, then rolls it back, leaving public schema empty", async () => {
    expect(await publicTableNames(testDb)).toEqual([]);

    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });

    expect(await publicTableNames(testDb)).toEqual(["plan", "plan_price", "price_tier", "service"]);

    const rolledBack = await rollbackAll(testDb.db, DRIZZLE_DIR);

    expect(rolledBack).toEqual(["0000_catalog_schema"]);
    expect(await publicTableNames(testDb)).toEqual([]);
  });
});
