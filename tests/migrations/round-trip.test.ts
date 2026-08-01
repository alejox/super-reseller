import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";

import { createTestDb, closeTestDb, type TestDb } from "../support/pglite-db";
import { rollbackAll } from "@/shared/db/migrator";

// EB: Migrations Are Clean and Reversible.
// These are throwaway fixture migrations (tests/fixtures/migrations), not
// the real product schema — that ships in slices 3b/4. This test proves the
// apply + hand-authored-down-migration round trip mechanism itself works.
const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "migrations",
);

async function publicTableCount(testDb: TestDb): Promise<number> {
  const result = await testDb.db.execute<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

describe("migration round trip (apply then rollback all)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("applies all migrations then rolls back all, leaving public schema empty", async () => {
    expect(await publicTableCount(testDb)).toBe(0);

    await migrate(testDb.db, { migrationsFolder: FIXTURES_DIR });

    expect(await publicTableCount(testDb)).toBe(1);

    const rolledBack = await rollbackAll(testDb.db, FIXTURES_DIR);

    expect(rolledBack).toEqual(["0000_probe_round_trip"]);
    expect(await publicTableCount(testDb)).toBe(0);
  });
});
