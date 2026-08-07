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

/** Tables with RLS switched on, read from the catalog 0004 actually writes to. */
async function rlsEnabledTableNames(testDb: TestDb): Promise<string[]> {
  const result = await testDb.db.execute<{ relname: string }>(
    sql`SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        ORDER BY c.relname`,
  );
  return result.rows.map((row) => row.relname);
}

describe("catalog migration round trip (apply then rollback all)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("applies all real migrations, then rolls them all back, leaving public schema empty", async () => {
    expect(await publicTableNames(testDb)).toEqual([]);

    expect(await rlsEnabledTableNames(testDb)).toEqual([]);

    // migrate() applies every journaled migration in folder order: the
    // catalog schema (0000), the identity schema (0001, added by M9), the
    // auth pair (0002 users.password_hash, 0003 sessions — slice 5a), and
    // the RLS lockdown (0004).
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });

    expect(await publicTableNames(testDb)).toEqual([
      "plan",
      "plan_price",
      "price_tier",
      "provider_account",
      "sales_order",
      "service",
      "sessions",
      "users",
      "wallet_entry",
    ]);

    // 0004 must cover EVERY table, not just the sensitive ones: a single
    // table left out is a readable copy of whatever it holds. PGlite has no
    // `anon` role, so the REVOKE half of 0004 is inert here and only the RLS
    // half is observable — the grants are asserted against Supabase itself.
    expect(await rlsEnabledTableNames(testDb)).toEqual([
      "plan",
      "plan_price",
      "price_tier",
      // Every table added after 0004 has to enable RLS in its own migration.
      "provider_account",
      "sales_order",
      "service",
      "sessions",
      "users",
      // 0005 had to enable this one itself. 0004 revoked Supabase's default
      // GRANTs so a new table gets none, but RLS is per-table state that a
      // freshly created table simply does not inherit — and drizzle-kit will
      // never emit the line. This assertion is the tripwire for the next
      // table someone adds without it.
      "wallet_entry",
    ]);

    const rolledBack = await rollbackAll(testDb.db, DRIZZLE_DIR);

    expect(rolledBack).toEqual([
      "0009_customer_orders",
      "0008_provider_account",
      "0007_customer_role",
      "0006_sales_orders",
      "0005_wallet_ledger",
      "0004_rls_lockdown",
      "0003_sessions",
      "0002_identity_password_hash",
      "0001_groovy_smiling_tiger",
      "0000_catalog_schema",
    ]);
    expect(await publicTableNames(testDb)).toEqual([]);
  });
});
