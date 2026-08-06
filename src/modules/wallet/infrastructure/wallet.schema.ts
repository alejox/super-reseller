import { sql } from "drizzle-orm";
import { bigint, char, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/infrastructure/identity.schema";

/**
 * The wallet ledger. One row per movement, never updated, never deleted.
 *
 * There is NO `wallet` table and no `balance` column. A reseller with no
 * movements has a zero balance because it has no rows — nothing to create,
 * nothing to keep in sync, nothing that can disagree with the ledger.
 *
 * Schema-level import note: this file imports identity's SCHEMA (not its
 * domain types) for one foreign key. That is the same thing catalog's
 * `identity.schema.ts` already does in reverse for `price_tier`; the
 * module-boundary rule bars domain ENTITY types, and DDL is where foreign
 * keys are declared.
 */
export const walletEntry = pgTable(
  "wallet_entry",
  {
    id: uuid("id").primaryKey(),
    /**
     * The ownership axis `tenantWhere` filters on. Naming the column
     * `reseller_id` is what makes this table passable to that function at
     * all — the type requires the column, so a wallet read that forgot to
     * scope itself is a compile error rather than a leak.
     */
    resellerId: uuid("reseller_id").notNull(),
    kind: text("kind").notNull(),
    // SIGNED, unlike `plan_price.amount_minor` which is `>= 0`: a debit is a
    // negative row, so the balance is a plain SUM with no sign bookkeeping.
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    memo: text("memo"),
    // ON DELETE RESTRICT: users are soft-deleted, so this can only fire on a
    // genuine hard delete — and a ledger entry whose author vanished is an
    // unauditable ledger entry.
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // Every read is "this reseller's movements, newest first". Without this
    // the balance query degrades into a full scan as the ledger grows, and a
    // ledger only ever grows.
    index("wallet_entry_reseller_idx").on(table.resellerId, table.createdAt),
    check("wallet_entry_kind_check", sql`${table.kind} IN ('TOPUP', 'ADJUSTMENT')`),
    // A zero movement records nothing; it is noise in a statement a reseller
    // has to read, and the domain refuses it too.
    check("wallet_entry_amount_minor_check", sql`${table.amountMinor} <> 0`),
    check("wallet_entry_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);
