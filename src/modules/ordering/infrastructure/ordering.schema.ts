import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { plan, planPrice } from "@/modules/catalog/infrastructure/catalog.schema";
import { users } from "@/modules/identity/infrastructure/identity.schema";
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
     * The ledger row that paid for this order. UNIQUE: one debit funds
     * exactly one order, so a double-spend of the same entry is rejected by
     * the database rather than by a code path that has to remember.
     */
    walletEntryId: uuid("wallet_entry_id")
      .notNull()
      .unique()
      .references(() => walletEntry.id, { onDelete: "restrict" }),
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
    check(
      "sales_order_status_check",
      sql`${table.status} IN ('PENDING', 'FULFILLED', 'CANCELLED')`,
    ),
    // A status and its timestamp cannot disagree: FULFILLED requires a
    // fulfilment date, and anything else forbids one. Without this, a row
    // could claim delivery with no date, or a date with no delivery.
    check(
      "sales_order_fulfilled_at_check",
      sql`(${table.status} = 'FULFILLED' AND ${table.fulfilledAt} IS NOT NULL) OR (${table.status} <> 'FULFILLED' AND ${table.fulfilledAt} IS NULL)`,
    ),
  ],
);
