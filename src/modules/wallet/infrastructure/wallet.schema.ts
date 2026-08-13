import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

/**
 * A claim that money arrived, waiting for a human to validate it.
 *
 * The MIRROR IMAGE of `withdrawal_request`: that table debits when the request
 * opens, this one credits only when the request is approved. See
 * `domain/payment-request.ts` for why the asymmetry is correct rather than an
 * inconsistency.
 *
 * `wallet_entry_id` is NULL until approval, so "was this approved" and "did
 * the balance move" are one fact stored once — the CHECK below makes the two
 * unable to tell different stories.
 */
export const paymentRequest = pgTable(
  "payment_request",
  {
    id: uuid("id").primaryKey(),
    /** The ownership axis `tenantWhere` filters on. */
    resellerId: uuid("reseller_id").notNull(),
    // POSITIVE, like `withdrawal_request.amount_minor`: this records what was
    // CLAIMED. The entry it points at once approved carries the sign.
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    method: text("method").notNull(),
    /** The only link back to the real-world transfer. */
    reference: text("reference").notNull(),
    /** Receipt image or link. NOT NULL: a claim with no proof is a rumour. */
    proofUrl: text("proof_url").notNull(),
    status: text("status").notNull(),
    // RESTRICT and UNIQUE: a request can never credit twice, and the credit
    // it produced can never be deleted out from under the audit trail.
    walletEntryId: uuid("wallet_entry_id")
      .unique()
      .references(() => walletEntry.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
  },
  (table) => [
    // The two reads this table gets: one reseller's history, and the whole
    // pending queue.
    index("payment_request_reseller_idx").on(table.resellerId, table.createdAt),
    index("payment_request_status_idx").on(table.status, table.createdAt),
    /**
     * Payment reference uniqueness (backlog A8), enforced where it actually
     * matters. PARTIAL — `WHERE status = 'APPROVED'` — because the same
     * reference legitimately appears on a rejected claim and its corrected
     * resubmission. Uniqueness across all rows would block the operator from
     * ever fixing a mistake.
     *
     * `lower(reference)` matches `referenceKey()` in the domain exactly. If
     * those two ever drift, the application check passes and this INSERT
     * throws — which is the safe direction, but they are written to be read
     * side by side.
     */
    uniqueIndex("payment_request_reference_approved_idx")
      .on(sql`lower(${table.reference})`)
      .where(sql`${table.status} = 'APPROVED'`),
    check("payment_request_status_check", sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
    check(
      "payment_request_method_check",
      sql`${table.method} IN ('BANK_TRANSFER', 'NEQUI', 'DAVIPLATA', 'BINANCE_PAY', 'CASH', 'OTHER')`,
    ),
    check("payment_request_amount_minor_check", sql`${table.amountMinor} > 0`),
    check("payment_request_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("payment_request_reference_check", sql`length(btrim(${table.reference})) > 0`),
    check("payment_request_proof_check", sql`length(btrim(${table.proofUrl})) > 0`),
    // A credit exists if and only if the request was approved. This is the
    // constraint that makes "approved but never credited" — the exact bug
    // this table was created to prevent — unrepresentable.
    check(
      "payment_request_credit_check",
      sql`(${table.status} = 'APPROVED') = (${table.walletEntryId} IS NOT NULL)`,
    ),
    // A decision has a decider, and a pending request has none. Backlog A10
    // is this line: there is no way to store a reviewed request without
    // recording who reviewed it and when.
    check(
      "payment_request_review_check",
      sql`(${table.status} = 'PENDING') = (${table.reviewedBy} IS NULL AND ${table.reviewedAt} IS NULL)`,
    ),
    // A rejection always says why.
    check(
      "payment_request_rejection_reason_check",
      sql`${table.status} <> 'REJECTED' OR length(btrim(coalesce(${table.decisionNote}, ''))) > 0`,
    ),
  ],
);

/**
 * The platform's top-up limits. ONE ROW, forever — `id` is a boolean pinned
 * to `true` by a CHECK, which is the cheapest singleton Postgres offers: a
 * second row is a primary-key violation rather than a silent duplicate two
 * screens could disagree about.
 *
 * Unlike `withdrawal_settings` below, this is configured by the ADMIN, not by
 * the reseller it governs. A limit the controlled party can raise on itself is
 * not a control.
 */
export const topUpSettings = pgTable(
  "topup_settings",
  {
    id: boolean("id").primaryKey().default(true),
    // COP pesos, NOT cents — see `domain/top-up-limits.ts`.
    minAmountMinor: bigint("min_amount_minor", { mode: "number" }).notNull().default(10_000),
    maxAmountMinor: bigint("max_amount_minor", { mode: "number" }).notNull().default(5_000_000),
    currency: char("currency", { length: 3 }).notNull().default("COP"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    check("topup_settings_singleton_check", sql`${table.id} = true`),
    check("topup_settings_min_check", sql`${table.minAmountMinor} > 0`),
    // A range nobody can satisfy would block every top-up on the platform.
    check("topup_settings_range_check", sql`${table.maxAmountMinor} >= ${table.minAmountMinor}`),
    check("topup_settings_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
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
