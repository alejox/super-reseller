import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";

/**
 * `sales_order` buyer-discriminator CHECKs, proven at the SCHEMA level
 * against real Postgres (PGlite), mirroring
 * `provider-account.schema.test.ts` and `identity.schema.test.ts`'s
 * approach (design.md "Decision: `sales_order` gains a buyer discriminator;
 * no `customer_order` table").
 *
 * Task 3.1 RED: this file is written and run BEFORE `drizzle/0009_customer_
 * orders.sql` and `ordering.schema.ts`'s CHECK rewrite exist, so every
 * assertion below fails — either the columns/constraints referenced do not
 * exist yet, or the CHECK that should reject a row is not yet in place.
 *
 * Task 3.2 is the explicit regression proof: CP: Reseller Ordering
 * Invariant Is Unchanged — a reused `wallet_entry_id` must still be
 * rejected by the untouched `UNIQUE(wallet_entry_id)` constraint after the
 * `NOT NULL` is relaxed to conditional. No pre-existing test asserting this
 * was found anywhere in the codebase (verified by search — only the schema
 * file's own comment mentioned the guarantee), so this test is authored
 * fresh here rather than "re-run unmodified"; it stands as the first and
 * only proof of that invariant, now and going forward.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const TIER = "99999999-9999-4999-8999-999999999999";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const RESELLER_USER = "aaaa1111-0000-4000-8000-000000000002";
const RESELLER = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_USER = "bbbb2222-0000-4000-8000-000000000003";
const CUSTOMER = CUSTOMER_USER;
const SERVICE = "cccc3333-0000-4000-8000-000000000004";
const PLAN = "dddd4444-0000-4000-8000-000000000005";
const PRICE = "eeee5555-0000-4000-8000-000000000006";
const PROVIDER_ACCOUNT = "ffff6666-0000-4000-8000-000000000007";

async function seed(testDb: TestDb): Promise<void> {
  const db = testDb.db;
  await db.execute(
    sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${TIER}, 'MINOR', 'Minorista', now())`,
  );
  await db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN}, 'admin@example.com', '$argon2id$x', 'ADMIN', NULL, NULL, now())`,
  );
  await db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${RESELLER_USER}, 'reseller@example.com', '$argon2id$x', 'RESELLER', ${RESELLER}, ${TIER}, now())`,
  );
  await db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${CUSTOMER_USER}, 'customer@example.com', '$argon2id$x', 'CUSTOMER', ${CUSTOMER}, ${TIER}, now())`,
  );
  await db.execute(
    sql`INSERT INTO service (id, slug, name, created_at, updated_at) VALUES (${SERVICE}, 'netflix', 'Netflix', now(), now())`,
  );
  await db.execute(
    sql`INSERT INTO plan (id, service_id, name, kind, duration_days, created_at, updated_at) VALUES (${PLAN}, ${SERVICE}, '1 Pantalla', 'SCREEN', 30, now(), now())`,
  );
  await db.execute(
    sql`INSERT INTO plan_price (id, plan_id, price_tier_id, amount_minor, currency, effective_from) VALUES (${PRICE}, ${PLAN}, ${TIER}, 15000, 'COP', now())`,
  );
  await db.execute(
    sql`INSERT INTO provider_account (id, reseller_id, service_id, panel_username, created_by, created_at) VALUES (${PROVIDER_ACCOUNT}, ${CUSTOMER}, ${SERVICE}, 'cust_panel_user', ${CUSTOMER_USER}, now())`,
  );
}

async function insertWalletEntry(testDb: TestDb, id: string): Promise<void> {
  await testDb.db.execute(
    sql`INSERT INTO wallet_entry (id, reseller_id, kind, amount_minor, currency, memo, created_by, created_at) VALUES (${id}, ${RESELLER}, 'TOPUP', 15000, 'COP', NULL, ${ADMIN}, now())`,
  );
}

type OrderRow = Readonly<{
  id: string;
  resellerId: string;
  walletEntryId: string | null;
  buyerKind: "RESELLER" | "CUSTOMER";
  providerAccountId: string | null;
  status: string;
}>;

async function insertOrder(testDb: TestDb, row: OrderRow): Promise<void> {
  await testDb.db.execute(
    sql`INSERT INTO sales_order (id, reseller_id, placed_by, plan_id, plan_price_id, wallet_entry_id, buyer_kind, provider_account_id, status, placed_at)
        VALUES (${row.id}, ${row.resellerId}, ${ADMIN}, ${PLAN}, ${PRICE}, ${row.walletEntryId}, ${row.buyerKind}, ${row.providerAccountId}, ${row.status}, now())`,
  );
}

describe("sales_order buyer-discriminator CHECKs", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
    await seed(testDb);
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("rejects a reseller order with no wallet_entry_id (sales_order_funding_check)", async () => {
    await expect(
      insertOrder(testDb, {
        id: crypto.randomUUID(),
        resellerId: RESELLER,
        walletEntryId: null,
        buyerKind: "RESELLER",
        providerAccountId: null,
        status: "PENDING",
      }),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("sales_order_funding_check"),
      }),
    });
  });

  it("rejects a reseller order awaiting payment (sales_order_status_buyer_check)", async () => {
    const entryId = crypto.randomUUID();
    await insertWalletEntry(testDb, entryId);

    await expect(
      insertOrder(testDb, {
        id: crypto.randomUUID(),
        resellerId: RESELLER,
        walletEntryId: entryId,
        buyerKind: "RESELLER",
        providerAccountId: null,
        status: "AWAITING_PAYMENT",
      }),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("sales_order_status_buyer_check"),
      }),
    });
  });

  it("rejects a customer order carrying a wallet_entry_id (sales_order_funding_check)", async () => {
    const entryId = crypto.randomUUID();
    await insertWalletEntry(testDb, entryId);

    await expect(
      insertOrder(testDb, {
        id: crypto.randomUUID(),
        resellerId: CUSTOMER,
        walletEntryId: entryId,
        buyerKind: "CUSTOMER",
        providerAccountId: PROVIDER_ACCOUNT,
        status: "AWAITING_PAYMENT",
      }),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("sales_order_funding_check"),
      }),
    });
  });

  it("accepts a valid reseller order (wallet entry, no provider account, PENDING)", async () => {
    const entryId = crypto.randomUUID();
    await insertWalletEntry(testDb, entryId);

    await expect(
      insertOrder(testDb, {
        id: crypto.randomUUID(),
        resellerId: RESELLER,
        walletEntryId: entryId,
        buyerKind: "RESELLER",
        providerAccountId: null,
        status: "PENDING",
      }),
    ).resolves.toBeUndefined();
  });

  it("accepts a valid customer order (provider account, no wallet entry, AWAITING_PAYMENT)", async () => {
    await expect(
      insertOrder(testDb, {
        id: crypto.randomUUID(),
        resellerId: CUSTOMER,
        walletEntryId: null,
        buyerKind: "CUSTOMER",
        providerAccountId: PROVIDER_ACCOUNT,
        status: "AWAITING_PAYMENT",
      }),
    ).resolves.toBeUndefined();
  });

  // CP: Reseller Ordering Invariant Is Unchanged (task 3.2's regression proof).
  it("still rejects a second reseller order that reuses the same wallet entry", async () => {
    const entryId = crypto.randomUUID();
    await insertWalletEntry(testDb, entryId);

    await insertOrder(testDb, {
      id: crypto.randomUUID(),
      resellerId: RESELLER,
      walletEntryId: entryId,
      buyerKind: "RESELLER",
      providerAccountId: null,
      status: "PENDING",
    });

    await expect(
      insertOrder(testDb, {
        id: crypto.randomUUID(),
        resellerId: RESELLER,
        walletEntryId: entryId,
        buyerKind: "RESELLER",
        providerAccountId: null,
        status: "PENDING",
      }),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("sales_order_wallet_entry_id_unique"),
      }),
    });
  });
});
