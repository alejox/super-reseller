import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

import * as schema from "../../src/shared/db/schema";
import { mintAdminScope } from "../../src/modules/identity/domain/access-scope";
import { DrizzleOrderingRepository } from "../../src/modules/ordering/infrastructure/drizzle-ordering-repository";

/**
 * Proves the overdraft guard against REAL Postgres, with real concurrency.
 *
 * The contract suite runs on PGlite, which is Postgres compiled to WASM
 * behind a SINGLE backend: two "concurrent" transactions there serialize by
 * construction, so that suite would pass even with the `FOR UPDATE` lock
 * removed. It proves the happy path and the refusal; it cannot prove the
 * race. This script can, because a `pg` Pool opens several real connections.
 *
 * Run it against a scratch reseller id; it cleans up after itself.
 *
 *   npx tsx --env-file=.env.local scripts/db/probe-concurrency.ts
 */
const RESELLER = "0f0f0f0f-0000-4000-8000-00000000f00d";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  const db = drizzle(pool, { schema });

  const admin = await db.execute<{ id: string } & Record<string, unknown>>(
    sql`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`,
  );
  const adminId = String(admin.rows[0]?.id);

  const price = await db.execute<
    { id: string; plan_id: string; amount_minor: string } & Record<string, unknown>
  >(sql`SELECT id, plan_id, amount_minor FROM plan_price WHERE effective_to IS NULL LIMIT 1`);
  const row = price.rows[0];
  if (!row) throw new Error("No current plan price to buy — seed the catalog first.");

  const amountMinor = Number(row.amount_minor);

  // A wallet holding funds for EXACTLY ONE order.
  await db.execute(sql`DELETE FROM sales_order WHERE reseller_id = ${RESELLER}`);
  await db.execute(sql`DELETE FROM wallet_entry WHERE reseller_id = ${RESELLER}`);
  await db.execute(
    sql`INSERT INTO wallet_entry (id, reseller_id, kind, amount_minor, currency, memo, created_by, created_at) VALUES (${crypto.randomUUID()}, ${RESELLER}, 'TOPUP', ${amountMinor}, 'COP', 'probe', ${adminId}, now())`,
  );

  const repo = new DrizzleOrderingRepository(db, mintAdminScope(adminId));
  const command = {
    resellerId: RESELLER,
    placedBy: adminId,
    planId: String(row.plan_id),
    planPriceId: String(row.id),
    amountMinor,
    currency: "COP",
  };

  const CONCURRENCY = 6;

  // Pre-warm the pool. `pg` opens connections LAZILY, and a fresh TLS
  // handshake to Supabase costs far more than the transaction itself — so
  // firing six calls at a cold pool lets the first one finish before the
  // others are even connected. That is not a race, and a probe that never
  // races cannot prove a lock. Holding every client open first, then
  // releasing them together, is what puts the six transactions in flight at
  // the same time.
  const warm = await Promise.all(Array.from({ length: CONCURRENCY }, () => pool.connect()));
  for (const client of warm) client.release();

  const outcomes = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => repo.placeOrder(command)),
  );

  const balance = await db.execute<{ b: number } & Record<string, unknown>>(
    sql`SELECT coalesce(sum(amount_minor), 0)::int AS b FROM wallet_entry WHERE reseller_id = ${RESELLER}`,
  );
  const orders = await db.execute<{ n: number } & Record<string, unknown>>(
    sql`SELECT count(*)::int AS n FROM sales_order WHERE reseller_id = ${RESELLER}`,
  );

  console.log("ATTEMPTS:", CONCURRENCY);
  console.log("PRICE:", amountMinor);
  console.log("SUCCEEDED:", outcomes.filter((outcome) => outcome.ok).length);
  console.log("REFUSED:", outcomes.filter((outcome) => !outcome.ok).length);
  console.log("FINAL BALANCE:", Number(balance.rows[0]?.b));
  console.log("ORDERS:", Number(orders.rows[0]?.n));

  await db.execute(sql`DELETE FROM sales_order WHERE reseller_id = ${RESELLER}`);
  await db.execute(sql`DELETE FROM wallet_entry WHERE reseller_id = ${RESELLER}`);
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
