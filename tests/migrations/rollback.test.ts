import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createTestDb, closeTestDb, type TestDb } from "../support/pglite-db";
import {
  MissingDownMigrationError,
  NoMigrationsToRollbackError,
  appliedMigrationCount,
  rollbackLast,
} from "@/shared/db/migrator";

const FIXTURES_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);
const MULTI_FIXTURES_DIR = path.join(FIXTURES_ROOT, "migrations-multi");
const MISSING_DOWN_FIXTURES_DIR = path.join(
  FIXTURES_ROOT,
  "migrations-missing-down",
);

describe("rollbackLast", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("rolls back the most recently applied migration first (LIFO)", async () => {
    await migrate(testDb.db, { migrationsFolder: MULTI_FIXTURES_DIR });
    expect(await appliedMigrationCount(testDb.db)).toBe(2);

    const first = await rollbackLast(testDb.db, MULTI_FIXTURES_DIR);
    expect(first).toBe("0001_probe_b");
    expect(await appliedMigrationCount(testDb.db)).toBe(1);

    const second = await rollbackLast(testDb.db, MULTI_FIXTURES_DIR);
    expect(second).toBe("0000_probe_a");
    expect(await appliedMigrationCount(testDb.db)).toBe(0);
  });

  it("throws NoMigrationsToRollbackError when nothing has ever been applied", async () => {
    await expect(
      rollbackLast(testDb.db, MULTI_FIXTURES_DIR),
    ).rejects.toBeInstanceOf(NoMigrationsToRollbackError);
  });

  it("throws MissingDownMigrationError when the hand-authored down file is absent", async () => {
    await migrate(testDb.db, { migrationsFolder: MISSING_DOWN_FIXTURES_DIR });

    const error = await rollbackLast(
      testDb.db,
      MISSING_DOWN_FIXTURES_DIR,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MissingDownMigrationError);
    expect((error as InstanceType<typeof MissingDownMigrationError>).tag).toBe(
      "0000_no_down",
    );
  });
});
