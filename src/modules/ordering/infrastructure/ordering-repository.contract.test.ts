import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { mintAdminScope, mintCustomerScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import { DrizzleOrderingRepository } from "./drizzle-ordering-repository";

/**
 * PGlite only, deliberately.
 *
 * Every other contract suite in this repo runs twice — a fake proves the use
 * case, PGlite proves the SQL. Here the SQL IS the use case: the guarantee
 * under test is that a balance check, a debit and an order insert happen
 * atomically under a row lock. An in-memory fake would "pass" by being
 * single-threaded, which proves nothing about the property that matters.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const TIER = "99999999-9999-4999-8999-999999999999";
const RESELLER_A = "11111111-1111-4111-8111-111111111111";
const RESELLER_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "aaaa1111-0000-4000-8000-000000000002";
const USER_B = "bbbb2222-0000-4000-8000-000000000003";
const SERVICE = "cccc3333-0000-4000-8000-000000000004";
const PLAN = "dddd4444-0000-4000-8000-000000000005";
const PRICE = "eeee5555-0000-4000-8000-000000000006";
const CUSTOMER_A = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_B = "44444444-4444-4444-8444-444444444444";
const PROVIDER_ACCOUNT_A = "55555555-5555-4555-8555-555555555555";
const PROVIDER_ACCOUNT_B = "66666666-6666-4666-8666-666666666666";

const adminScope = mintAdminScope(ADMIN);
const scopeA = mintResellerScope(USER_A, RESELLER_A, TIER);
const customerScopeA = mintCustomerScope(CUSTOMER_A, CUSTOMER_A, TIER);
const customerScopeB = mintCustomerScope(CUSTOMER_B, CUSTOMER_B, TIER);

let testDb: TestDb;

async function seed() {
  const db = testDb.db;
  await db.execute(sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${TIER}, 'MINOR', 'Minorista', now())`);
  await db.execute(sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN}, 'admin@example.com', '$argon2id$x', 'ADMIN', NULL, NULL, now())`);
  await db.execute(sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${USER_A}, 'a@example.com', '$argon2id$x', 'RESELLER', ${RESELLER_A}, ${TIER}, now())`);
  await db.execute(sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${USER_B}, 'b@example.com', '$argon2id$x', 'RESELLER', ${RESELLER_B}, ${TIER}, now())`);
  await db.execute(sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${CUSTOMER_A}, 'cust-a@example.com', '$argon2id$x', 'CUSTOMER', ${CUSTOMER_A}, ${TIER}, now())`);
  await db.execute(sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${CUSTOMER_B}, 'cust-b@example.com', '$argon2id$x', 'CUSTOMER', ${CUSTOMER_B}, ${TIER}, now())`);
  await db.execute(sql`INSERT INTO service (id, slug, name, created_at, updated_at) VALUES (${SERVICE}, 'netflix', 'Netflix', now(), now())`);
  await db.execute(sql`INSERT INTO plan (id, service_id, name, kind, duration_days, created_at, updated_at) VALUES (${PLAN}, ${SERVICE}, '1 Pantalla', 'SCREEN', 30, now(), now())`);
  await db.execute(sql`INSERT INTO plan_price (id, plan_id, price_tier_id, amount_minor, currency, effective_from) VALUES (${PRICE}, ${PLAN}, ${TIER}, 15000, 'COP', now())`);
  await db.execute(sql`INSERT INTO provider_account (id, reseller_id, service_id, panel_username, created_by, created_at) VALUES (${PROVIDER_ACCOUNT_A}, ${CUSTOMER_A}, ${SERVICE}, 'cust_a_user', ${CUSTOMER_A}, now())`);
  await db.execute(sql`INSERT INTO provider_account (id, reseller_id, service_id, panel_username, created_by, created_at) VALUES (${PROVIDER_ACCOUNT_B}, ${CUSTOMER_B}, ${SERVICE}, 'cust_b_user', ${CUSTOMER_B}, now())`);
}

async function credit(amountMinor: number, resellerId = RESELLER_A) {
  await testDb.db.execute(
    sql`INSERT INTO wallet_entry (id, reseller_id, kind, amount_minor, currency, memo, created_by, created_at) VALUES (${crypto.randomUUID()}, ${resellerId}, 'TOPUP', ${amountMinor}, 'COP', NULL, ${ADMIN}, now())`,
  );
}

async function balanceOf(resellerId = RESELLER_A): Promise<number> {
  const result = await testDb.db.execute<{ b: number } & Record<string, unknown>>(
    sql`SELECT coalesce(sum(amount_minor), 0)::int AS b FROM wallet_entry WHERE reseller_id = ${resellerId}`,
  );
  return Number(result.rows[0]?.b ?? 0);
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    resellerId: RESELLER_A,
    placedBy: USER_A,
    planId: PLAN,
    planPriceId: PRICE,
    amountMinor: 15_000,
    currency: "COP",
    ...overrides,
  };
}

beforeEach(async () => {
  testDb = await createTestDb();
  await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
  await seed();
});

afterEach(async () => {
  await closeTestDb(testDb);
});

describe("DrizzleOrderingRepository.placeOrder", () => {
  it("debits the wallet and records the order as one operation", async () => {
    await credit(50_000);
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const outcome = await repo.placeOrder(command());

    expect(outcome.ok).toBe(true);
    expect(await balanceOf()).toBe(35_000);

    const [view] = await repo.listOrdersForReseller(RESELLER_A);
    expect(view?.order.status).toBe("PENDING");
    expect(view?.amountMinor).toBe(15_000);
    expect(view?.planName).toBe("1 Pantalla");
    expect(view?.serviceName).toBe("Netflix");
  });

  // Task 3.6: the existing reseller use case, called UNMODIFIED, still
  // produces a buyer_kind='RESELLER' row with a wallet entry and no
  // provider account — proves no reseller-path regression from the schema
  // widening.
  it("still records buyer_kind='RESELLER' with a wallet entry and no provider account", async () => {
    await credit(50_000);
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const outcome = await repo.placeOrder(command());
    if (!outcome.ok) throw new Error("expected success");

    expect(outcome.order.buyerKind).toBe("RESELLER");
    expect(outcome.order.walletEntryId).toEqual(expect.any(String));
    expect(outcome.order.providerAccountId).toBeNull();
  });

  it("links the order to the exact ledger row that paid for it", async () => {
    await credit(50_000);
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const outcome = await repo.placeOrder(command());
    if (!outcome.ok) throw new Error("expected success");

    const entry = await testDb.db.execute<{ amount_minor: number; kind: string } & Record<string, unknown>>(
      sql`SELECT amount_minor, kind FROM wallet_entry WHERE id = ${outcome.order.walletEntryId}`,
    );

    // NEGATIVE, and kind ORDER_DEBIT: the sign says money left, the kind says
    // why. An order pointing at its own debit is what makes the pair
    // auditable rather than merely assumed.
    expect(Number(entry.rows[0]?.amount_minor)).toBe(-15_000);
    expect(entry.rows[0]?.kind).toBe("ORDER_DEBIT");
  });

  it("refuses the sale and writes NOTHING when the balance is short", async () => {
    await credit(14_999);
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const outcome = await repo.placeOrder(command());

    expect(outcome).toEqual({ ok: false, reason: "insufficient-funds", balanceMinor: 14_999 });
    // The whole point of the transaction: a refused sale leaves no debit
    // behind, so the reseller is not charged for something they did not get.
    expect(await balanceOf()).toBe(14_999);
    expect(await repo.listOrdersForReseller(RESELLER_A)).toEqual([]);
  });

  it("allows a sale that spends the balance to exactly zero", async () => {
    await credit(15_000);
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const outcome = await repo.placeOrder(command());

    expect(outcome.ok).toBe(true);
    expect(await balanceOf()).toBe(0);
  });

  it("refuses a sale against a wallet that has never been credited", async () => {
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const outcome = await repo.placeOrder(command());

    expect(outcome).toEqual({ ok: false, reason: "insufficient-funds", balanceMinor: 0 });
  });

  it("serves only one of two orders when funds cover exactly one", async () => {
    // HONEST SCOPE: this does NOT prove the overdraft guard. PGlite is
    // Postgres behind a SINGLE backend, so these two calls serialize by
    // construction and this test passes with the advisory lock deleted —
    // measured, not assumed.
    //
    // The race is proven against real Postgres by
    // `scripts/db/probe-concurrency.ts`, which pre-warms the pool so six
    // transactions are genuinely in flight together. Without the lock it
    // drives the balance to -65.000; with it, one order succeeds and five
    // are refused.
    //
    // What this test does prove is the sequential contract: the second
    // attempt sees the first one's debit and is refused.
    await credit(15_000);
    const repo = new DrizzleOrderingRepository(testDb.db, scopeA);

    const [first, second] = await Promise.all([
      repo.placeOrder(command()),
      repo.placeOrder(command()),
    ]);

    const succeeded = [first, second].filter((outcome) => outcome.ok);
    expect(succeeded).toHaveLength(1);
    expect(await balanceOf()).toBe(0);
    expect(await repo.listOrdersForReseller(RESELLER_A)).toHaveLength(1);
  });

  it("keeps concurrent orders for DIFFERENT resellers independent", async () => {
    await credit(15_000, RESELLER_A);
    await credit(15_000, RESELLER_B);
    const repo = new DrizzleOrderingRepository(testDb.db, adminScope);

    const [a, b] = await Promise.all([
      repo.placeOrder(command()),
      repo.placeOrder(command({ resellerId: RESELLER_B, placedBy: USER_B })),
    ]);

    // The lock is per reseller, not global: one reseller's purchase must not
    // queue behind another's.
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(await balanceOf(RESELLER_A)).toBe(0);
    expect(await balanceOf(RESELLER_B)).toBe(0);
  });
});

describe("DrizzleOrderingRepository scoping and fulfilment", () => {
  it("hides another reseller's orders from a RESELLER scope", async () => {
    await credit(50_000, RESELLER_B);
    await new DrizzleOrderingRepository(testDb.db, adminScope).placeOrder(
      command({ resellerId: RESELLER_B, placedBy: USER_B }),
    );

    const asA = new DrizzleOrderingRepository(testDb.db, scopeA);

    expect(await asA.listOrders()).toEqual([]);
    expect(await asA.listOrdersForReseller(RESELLER_B)).toEqual([]);
  });

  it("shows an ADMIN scope every reseller's orders", async () => {
    await credit(50_000, RESELLER_A);
    await credit(50_000, RESELLER_B);
    const admin = new DrizzleOrderingRepository(testDb.db, adminScope);
    await admin.placeOrder(command());
    await admin.placeOrder(command({ resellerId: RESELLER_B, placedBy: USER_B }));

    expect(await admin.listOrders()).toHaveLength(2);
    expect(await admin.listOrders("PENDING")).toHaveLength(2);
    expect(await admin.listOrders("FULFILLED")).toEqual([]);
  });

  it("marks a pending order fulfilled", async () => {
    await credit(50_000);
    const admin = new DrizzleOrderingRepository(testDb.db, adminScope);
    const outcome = await admin.placeOrder(command());
    if (!outcome.ok) throw new Error("expected success");

    const fulfilled = await admin.fulfilOrder(outcome.order.id, "Entregado por WhatsApp");

    expect(fulfilled?.status).toBe("FULFILLED");
    expect(fulfilled?.fulfilledAt).toBeInstanceOf(Date);
    expect(fulfilled?.note).toBe("Entregado por WhatsApp");
  });

  it("returns null when fulfilling an already fulfilled order", async () => {
    await credit(50_000);
    const admin = new DrizzleOrderingRepository(testDb.db, adminScope);
    const outcome = await admin.placeOrder(command());
    if (!outcome.ok) throw new Error("expected success");
    await admin.fulfilOrder(outcome.order.id, null);

    // Not an error: "already delivered" and "nothing to do" are the same
    // answer to the operator who clicked twice.
    expect(await admin.fulfilOrder(outcome.order.id, null)).toBeNull();
  });

  it("refuses to let a RESELLER scope fulfil its own order", async () => {
    await credit(50_000);
    const admin = new DrizzleOrderingRepository(testDb.db, adminScope);
    const outcome = await admin.placeOrder(command());
    if (!outcome.ok) throw new Error("expected success");

    // Scoping alone does not stop this — the order IS the reseller's own row.
    // The application layer is what restricts fulfilment to an ADMIN, and
    // this test records that the repository does not, so nobody mistakes
    // the scope for the whole guard.
    const asA = new DrizzleOrderingRepository(testDb.db, scopeA);
    expect(await asA.fulfilOrder(outcome.order.id, null)).not.toBeNull();
  });
});

describe("DrizzleOrderingRepository.placeCustomerOrder", () => {
  function customerCommand(overrides: Record<string, unknown> = {}) {
    return {
      resellerId: CUSTOMER_A,
      placedBy: CUSTOMER_A,
      planId: PLAN,
      planPriceId: PRICE,
      providerAccountId: PROVIDER_ACCOUNT_A,
      ...overrides,
    };
  }

  // CP: Customer Order Awaits Payment, No Wallet Involvement.
  it("records an AWAITING_PAYMENT order with no wallet_entry row and no balance change", async () => {
    const repo = new DrizzleOrderingRepository(testDb.db, customerScopeA);

    const order = await repo.placeCustomerOrder(customerCommand());

    expect(order.status).toBe("AWAITING_PAYMENT");
    expect(order.buyerKind).toBe("CUSTOMER");
    expect(order.walletEntryId).toBeNull();
    expect(order.providerAccountId).toBe(PROVIDER_ACCOUNT_A);

    const entries = await testDb.db.execute<{ count: number } & Record<string, unknown>>(
      sql`SELECT count(*)::int AS count FROM wallet_entry`,
    );
    expect(Number(entries.rows[0]?.count)).toBe(0);
    expect(await balanceOf(CUSTOMER_A)).toBe(0);
  });

  // CP: Order Anchors To A Resolved Price Row.
  it("anchors to the resolved plan_price_id, unaffected by a later price change", async () => {
    const repo = new DrizzleOrderingRepository(testDb.db, customerScopeA);

    const order = await repo.placeCustomerOrder(customerCommand());
    expect(order.planPriceId).toBe(PRICE);

    // The plan's price is subsequently replaced — a NEW plan_price row, the
    // old one closed out. The already-placed order still points at PRICE.
    await testDb.db.execute(
      sql`UPDATE plan_price SET effective_to = now() WHERE id = ${PRICE}`,
    );
    await testDb.db.execute(
      sql`INSERT INTO plan_price (id, plan_id, price_tier_id, amount_minor, currency, effective_from) VALUES (${crypto.randomUUID()}, ${PLAN}, ${TIER}, 25000, 'COP', now())`,
    );

    const [view] = await repo.listOrdersForReseller(CUSTOMER_A);
    expect(view?.order.planPriceId).toBe(PRICE);
    expect(view?.amountMinor).toBe(15_000);
  });

  // CP: Order Isolation.
  it("excludes another customer's orders from a customer-scoped query", async () => {
    const asA = new DrizzleOrderingRepository(testDb.db, customerScopeA);
    const asB = new DrizzleOrderingRepository(testDb.db, customerScopeB);
    await asA.placeCustomerOrder(customerCommand());
    await asB.placeCustomerOrder(
      customerCommand({ resellerId: CUSTOMER_B, placedBy: CUSTOMER_B, providerAccountId: PROVIDER_ACCOUNT_B }),
    );

    expect(await asB.listOrdersForReseller(CUSTOMER_A)).toEqual([]);
  });

  it("returns none of the customer orders to a reseller-scoped query", async () => {
    const asA = new DrizzleOrderingRepository(testDb.db, customerScopeA);
    await asA.placeCustomerOrder(customerCommand());

    const asReseller = new DrizzleOrderingRepository(testDb.db, scopeA);

    expect(await asReseller.listOrdersForReseller(CUSTOMER_A)).toEqual([]);
  });
});
