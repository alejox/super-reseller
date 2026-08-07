import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { plan, planPrice } from "@/modules/catalog/infrastructure/catalog.schema";
import { users } from "@/modules/identity/infrastructure/identity.schema";
import { providerAccount } from "@/modules/provider-accounts/infrastructure/provider-account.schema";
import { walletEntry } from "@/modules/wallet/infrastructure/wallet.schema";

/**
 * Placed orders.
 *
 * Named `sales_order` rather than `order`, which is a reserved word in SQL —
 * a table that only works while every query remembers to quote it is a
 * booby trap for the first person who writes raw SQL against it.
 *
 * There is deliberately NO `amount_minor` column. The price lives on the
 * `plan_price` row this order points at, and that row is append-only: it is
 * never mutated, only closed out, so the id resolves to the exact amount the
 * sale was made at forever. A copied amount would be a second number able to
 * disagree with the ledger and with the price list.
 */
export const salesOrder = pgTable(
  "sales_order",
  {
    id: uuid("id").primaryKey(),
    /** The ownership axis `tenantWhere` filters on. */
    resellerId: uuid("reseller_id").notNull(),
    placedBy: uuid("placed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    // The order-time price anchor. RESTRICT, like every reference into the
    // catalog: a price row an order points at can never be deleted.
    planPriceId: uuid("plan_price_id")
      .notNull()
      .references(() => planPrice.id, { onDelete: "restrict" }),
    /**
     * The ledger row that paid for this order — RESELLER orders only
     * (design.md "Decision: `sales_order` gains a buyer discriminator; no
     * `customer_order` table"). NULL for a CUSTOMER order: `sales_order_
     * funding_check` requires it, so a customer order can never spend a
     * reseller's ledger row. `NOT NULL` is dropped, but `UNIQUE` is
     * untouched and stays global — Postgres ignores NULLs in a UNIQUE
     * index, so "one ledger entry funds exactly one order" is enforced
     * identically to before this change (CP: Reseller Ordering Invariant
     * Is Unchanged).
     */
    walletEntryId: uuid("wallet_entry_id")
      .unique()
      .references(() => walletEntry.id, { onDelete: "restrict" }),
    /**
     * The buyer discriminator (design.md). `text` + CHECK, not a Postgres
     * enum — same reasoning as `status` below: a value added to an
     * existing enum can never be removed once shipped.
     */
    buyerKind: text("buyer_kind").notNull(),
    /**
     * The provider account being purchased for — CUSTOMER orders only.
     * NULL for a RESELLER order: `sales_order_funding_check` requires it.
     * RESTRICT, like every other reference an order carries: an account an
     * order points at can never be deleted out from under it.
     */
    providerAccountId: uuid("provider_account_id").references(() => providerAccount.id, {
      onDelete: "restrict",
    }),
    status: text("status").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    note: text("note"),
  },
  (table) => [
    // Both screens read "this reseller's orders, newest first"; the admin
    // queue reads "everything still pending".
    index("sales_order_reseller_idx").on(table.resellerId, table.placedAt),
    index("sales_order_status_idx").on(table.status, table.placedAt),
    check("sales_order_buyer_kind_check", sql`${table.buyerKind} IN ('RESELLER', 'CUSTOMER')`),
    // The reseller invariant, proved unweakened (design.md): a RESELLER row
    // must carry a wallet entry and no provider account; a CUSTOMER row
    // must carry a provider account and NEVER a wallet entry — so a
    // customer order can never spend a reseller's ledger row. Every
    // combination of buyer_kind × wallet_entry_id × provider_account_id is
    // decided; none is left open.
    check(
      "sales_order_funding_check",
      sql`(${table.buyerKind} = 'RESELLER' AND ${table.walletEntryId} IS NOT NULL AND ${table.providerAccountId} IS NULL)
       OR (${table.buyerKind} = 'CUSTOMER' AND ${table.walletEntryId} IS NULL AND ${table.providerAccountId} IS NOT NULL)`,
    ),
    // Redesigned together with sales_order_status_buyer_check below, not
    // appended to: AWAITING_PAYMENT is the seam `payment-gateway` will
    // settle from, and it must be reachable by the schema before it can be
    // made unreachable for a reseller.
    check(
      "sales_order_status_check",
      sql`${table.status} IN ('AWAITING_PAYMENT', 'PENDING', 'FULFILLED', 'CANCELLED')`,
    ),
    // AWAITING_PAYMENT is unreachable for a RESELLER order: the new status
    // cannot park an unpaid reseller order, so reseller behavior is
    // strictly unchanged. A CUSTOMER order may hold any status.
    check(
      "sales_order_status_buyer_check",
      sql`(${table.buyerKind} = 'RESELLER' AND ${table.status} IN ('PENDING', 'FULFILLED', 'CANCELLED'))
       OR (${table.buyerKind} = 'CUSTOMER')`,
    ),
    // Rewritten as one boolean equality — logically identical to the
    // original two-disjunct form (`status` is NOT NULL, so neither side is
    // nullable) — and it now covers four statuses without enumerating them.
    check(
      "sales_order_fulfilled_at_check",
      sql`(${table.status} = 'FULFILLED') = (${table.fulfilledAt} IS NOT NULL)`,
    ),
  ],
);
