import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb, closeTestDb, type TestDb } from "../support/pglite-db";

/**
 * design.md open question: "Confirm at slice 2 that PGlite covers every
 * construct used here (partial unique indexes, functional unique index,
 * enums, CHECK)." PGlite runs in-process, so this is executed for real —
 * not asserted from documentation.
 */
describe("PGlite construct support", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("supports a partial unique index (uniqueness only where the predicate holds)", async () => {
    await testDb.db.execute(
      sql`CREATE TABLE partial_uniq_probe (id serial PRIMARY KEY, plan_id int NOT NULL, retired boolean NOT NULL DEFAULT false)`,
    );
    await testDb.db.execute(
      sql`CREATE UNIQUE INDEX partial_uniq_probe_idx ON partial_uniq_probe (plan_id) WHERE retired = false`,
    );

    await testDb.db.execute(
      sql`INSERT INTO partial_uniq_probe (plan_id, retired) VALUES (1, false)`,
    );
    // A second active row with the same plan_id must violate the index.
    await expect(
      testDb.db.execute(
        sql`INSERT INTO partial_uniq_probe (plan_id, retired) VALUES (1, false)`,
      ),
    ).rejects.toThrow();

    // A retired row with the same plan_id falls outside the partial
    // predicate, so it must be allowed.
    await expect(
      testDb.db.execute(
        sql`INSERT INTO partial_uniq_probe (plan_id, retired) VALUES (1, true)`,
      ),
    ).resolves.toBeDefined();
  });

  it("supports a functional unique index (lower(email))", async () => {
    await testDb.db.execute(
      sql`CREATE TABLE functional_uniq_probe (id serial PRIMARY KEY, email text NOT NULL)`,
    );
    await testDb.db.execute(
      sql`CREATE UNIQUE INDEX functional_uniq_probe_idx ON functional_uniq_probe (lower(email))`,
    );

    await testDb.db.execute(
      sql`INSERT INTO functional_uniq_probe (email) VALUES ('User@Example.com')`,
    );

    // Same address with different casing must violate the functional index.
    await expect(
      testDb.db.execute(
        sql`INSERT INTO functional_uniq_probe (email) VALUES ('user@example.com')`,
      ),
    ).rejects.toThrow();

    // A genuinely different address must be allowed.
    await expect(
      testDb.db.execute(
        sql`INSERT INTO functional_uniq_probe (email) VALUES ('other@example.com')`,
      ),
    ).resolves.toBeDefined();
  });

  it("supports a Postgres enum type, rejecting values outside the declared set", async () => {
    await testDb.db.execute(
      sql`CREATE TYPE probe_user_role AS ENUM ('ADMIN', 'RESELLER')`,
    );
    await testDb.db.execute(
      sql`CREATE TABLE enum_probe (id serial PRIMARY KEY, role probe_user_role NOT NULL)`,
    );

    await testDb.db.execute(
      sql`INSERT INTO enum_probe (role) VALUES ('ADMIN')`,
    );

    await expect(
      testDb.db.execute(
        sql`INSERT INTO enum_probe (role) VALUES ('SUPERADMIN')`,
      ),
    ).rejects.toThrow();
  });

  it("supports a CHECK constraint, rejecting rows that violate it", async () => {
    await testDb.db.execute(
      sql`CREATE TABLE check_probe (id serial PRIMARY KEY, amount_minor bigint NOT NULL CHECK (amount_minor >= 0))`,
    );

    await testDb.db.execute(
      sql`INSERT INTO check_probe (amount_minor) VALUES (0)`,
    );

    await expect(
      testDb.db.execute(sql`INSERT INTO check_probe (amount_minor) VALUES (-1)`),
    ).rejects.toThrow();
  });
});
