import { sql } from "drizzle-orm";
import { bigint, boolean, char, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    check(
      "wallet_entry_kind_check",
      sql`${table.kind} IN ('TOPUP', 'ADJUSTMENT', 'ORDER_DEBIT', 'WITHDRAWAL')`,
    ),
    // A zero movement records nothing; it is noise in a statement a reseller
    // has to read, and the domain refuses it too.
    check("wallet_entry_amount_minor_check", sql`${table.amountMinor} <> 0`),
    check("wallet_entry_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const withdrawalMethods = pgTable(
  "withdrawal_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resellerId: uuid("reseller_id").notNull(),
    type: text("type").notNull(), // 'BANK_TRANSFER', 'CRYPTO', 'PAYPAL', etc.
    details: text("details").notNull(), // JSON string o texto con los datos de la cuenta
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("withdrawal_methods_reseller_idx").on(table.resellerId),
    check(
      "withdrawal_methods_type_check",
      sql`${table.type} IN ('BANK_TRANSFER', 'CRYPTO', 'PAYPAL')`,
    ),
  ]
);

/**
 * A reseller taking money out. One row per attempt, including the refused
 * ones — a withdrawal nobody can see was declined is a support ticket.
 *
 * The row is NOT the money. `wallet_entry_id` points at the debit that
 * reserved the funds when the request opened, and `reversal_entry_id` at the
 * compensating credit if it was later rejected. Both are RESTRICT: a request
 * whose ledger entry vanished is an unauditable request.
 */
export const withdrawalRequest = pgTable(
  "withdrawal_request",
  {
    id: uuid("id").primaryKey(),
    resellerId: uuid("reseller_id").notNull(),
    // RESTRICT, not CASCADE: deactivating a method must never erase the
    // history of what was already paid into it.
    methodId: uuid("method_id")
      .notNull()
      .references(() => withdrawalMethods.id, { onDelete: "restrict" }),
    // POSITIVE, unlike `wallet_entry.amount_minor` which is signed: this
    // records how much was asked for, and the entry it points at carries the
    // sign. Two signed copies of one fact is how a report double-counts.
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    status: text("status").notNull(),
    walletEntryId: uuid("wallet_entry_id")
      .notNull()
      .references(() => walletEntry.id, { onDelete: "restrict" }),
    reversalEntryId: uuid("reversal_entry_id").references(() => walletEntry.id, {
      onDelete: "restrict",
    }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "restrict" }),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    note: text("note"),
  },
  (table) => [
    // The daily-cap query is "this reseller's requests since midnight", and
    // it runs inside the lock on every withdrawal. Without this index it is a
    // full scan holding a mutex.
    index("withdrawal_request_reseller_idx").on(table.resellerId, table.requestedAt),
    check(
      "withdrawal_request_status_check",
      sql`${table.status} IN ('PENDING_REVIEW', 'APPROVED', 'PAID', 'REJECTED')`,
    ),
    check("withdrawal_request_amount_minor_check", sql`${table.amountMinor} > 0`),
    check("withdrawal_request_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    // A reversal exists if and only if the request was rejected. The status
    // and the money must not be able to tell two different stories.
    check(
      "withdrawal_request_reversal_check",
      sql`(${table.status} = 'REJECTED') = (${table.reversalEntryId} IS NOT NULL)`,
    ),
  ],
);

export const withdrawalSettings = pgTable(
  "withdrawal_settings",
  {
    // Usamos reseller_id como PK porque es una configuración 1 a 1 por revendedor
    resellerId: uuid("reseller_id").primaryKey(),
    // Every `*_minor` below is in COP, whose smallest practical unit is the
    // PESO — `formatMoney` resolves COP to 0 fraction digits, so these are
    // NOT cents and must never be scaled by 100. Keep them in step with
    // `DEFAULT_WITHDRAWAL_SETTINGS` in `domain/withdrawal.ts`.
    autoWithdraw: boolean("auto_withdraw").notNull().default(false),
    condition: text("condition").notNull().default('THRESHOLD'), // 'SCHEDULED', 'THRESHOLD'
    thresholdAmountMinor: bigint("threshold_amount_minor", { mode: "number" }).notNull().default(5000), // $5.000 COP
    scheduleFrequency: text("schedule_frequency").notNull().default('MONTHLY'), // 'WEEKLY', 'BIWEEKLY', 'MONTHLY'
    minWithdrawalMinor: bigint("min_withdrawal_minor", { mode: "number" }).notNull().default(5000), // $5.000 COP
    maxDailyWithdrawalMinor: bigint("max_daily_withdrawal_minor", { mode: "number" }).notNull().default(500000), // $500.000 COP
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "withdrawal_settings_condition_check",
      sql`${table.condition} IN ('SCHEDULED', 'THRESHOLD')`,
    ),
    check(
      "withdrawal_settings_frequency_check",
      sql`${table.scheduleFrequency} IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')`,
    ),
  ]
);
