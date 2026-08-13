import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "../../identity/infrastructure/identity.schema";

/**
 * Source-accounts schema — the platform's own logins on a SUPPLIER's reseller
 * panel, and the credit balances those panels report back.
 *
 * Relative imports (not `@/modules/*`) on purpose, mirroring
 * `provider-account.schema.ts`'s own header: `drizzle-kit generate` loads this
 * file standalone via `src/shared/db/schema.ts` and is not guaranteed to
 * resolve tsconfig path aliases.
 *
 * THERE IS NO `reseller_id` COLUMN, and its absence is the design. Every other
 * business table carries one so `tenantWhere` can scope it; this one is
 * operator infrastructure owned by nobody but the platform, so scoping is
 * enforced at the composition root by `requireRole("ADMIN")` instead — the
 * same trade `topup_settings` makes.
 *
 * THERE IS NO `service_id` EITHER, and that is a correction rather than an
 * omission. A supplier panel login does not belong to Netflix or Disney: the
 * supplier sells by DEVICE COUNT ("Plan de 1 Dispositivo", "Plan de 3
 * Dispositivos"), not by streaming service. `panel_url` says which supplier
 * instead.
 *
 * THERE IS NO CREDENTIAL COLUMN. The panel asks for a verification code at
 * login and never again during a recharge, so a human logs in by hand and the
 * automation inherits the live session. Nothing needs the password.
 */
export const sourceAccount = pgTable(
  "source_account",
  {
    id: uuid("id").primaryKey(),
    // Which supplier panel this login belongs to.
    panelUrl: text("panel_url").notNull(),
    // The username on that panel. Never a credential.
    panelUsername: text("panel_username").notNull(),
    // Operator-facing nickname.
    label: text("label"),
    connectionStatus: text("connection_status").notNull().default("NEVER_CONNECTED"),
    // Last ATTEMPT, success or failure alike — a clock that only ticked on
    // success would report a week-dead account as "synced an hour ago".
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncError: text("last_sync_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    // Soft delete, project convention (mirrors `provider_account.archived_at`).
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    // The list screen reads "everything live, newest first", and the alert
    // banner reads "everything unhealthy" — both start from this order.
    index("source_account_status_idx").on(table.connectionStatus, table.createdAt),
    // The SAME login registered twice would let two workers drive one session
    // against each other. Partial on the live rows, mirroring
    // `provider_account_identity_uniq`'s shape: an archived account frees its
    // identity for a re-registered one.
    uniqueIndex("source_account_identity_uniq")
      .on(table.panelUrl, sql`lower(${table.panelUsername})`)
      .where(sql`${table.archivedAt} IS NULL`),
    check("source_account_panel_url_check", sql`length(btrim(${table.panelUrl})) > 0`),
    check("source_account_panel_username_check", sql`length(btrim(${table.panelUsername})) > 0`),
    check(
      "source_account_connection_status_check",
      sql`${table.connectionStatus} IN ('NEVER_CONNECTED', 'CONNECTED', 'LOGIN_ERROR', 'REQUIRES_2FA', 'BLOCKED')`,
    ),
    check("source_account_consecutive_failures_check", sql`${table.consecutiveFailures} >= 0`),
    // A never-connected account cannot have a sync clock, and any account that
    // HAS been attempted must have one.
    check(
      "source_account_sync_clock_check",
      sql`(${table.connectionStatus} = 'NEVER_CONNECTED') = (${table.lastSyncAt} IS NULL)`,
    ),
  ],
);

/**
 * The supplier's reported balances — A MIRROR, NOT A LEDGER.
 *
 * These rows are overwritten wholesale on every successful sync. There is no
 * running total, no debit, no credit and no history, deliberately: the
 * operator can spend from the supplier's panel by hand at any moment, so any
 * figure this platform computed for itself would be wrong by lunchtime. The
 * supplier is the only authority; this table is the last thing it said.
 *
 * `plan` is FREE TEXT with no CHECK, and that is deliberate too. "Plan de 1
 * Dispositivo" and "Plan de 3 Dispositivos" are the SUPPLIER's catalogue —
 * the day they add a third one it has to reach the operator's screen without
 * a migration, because their product decision must not become our outage.
 *
 * `period` IS constrained, because that one is ours: the panel states the two
 * meanings itself ("1 punto = 1 mes" against "1 punto = 12 meses").
 */
export const sourceAccountCredit = pgTable(
  "source_account_credit",
  {
    id: uuid("id").primaryKey(),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      // CASCADE, unlike every other reference in this codebase: a balance has
      // no meaning without the account that reported it, and there is nothing
      // to preserve for audit — the supplier still holds the real number.
      .references(() => sourceAccount.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    period: text("period").notNull(),
    points: integer("points").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("source_account_credit_account_idx").on(table.sourceAccountId),
    // One row per bucket per account. `lower(plan)` matches `creditKey()` in
    // the domain — if these two ever disagree the application check passes and
    // the INSERT throws, so they are written to be read side by side.
    uniqueIndex("source_account_credit_bucket_uniq").on(
      table.sourceAccountId,
      sql`lower(${table.plan})`,
      table.period,
    ),
    check("source_account_credit_plan_check", sql`length(btrim(${table.plan})) > 0`),
    check("source_account_credit_period_check", sql`${table.period} IN ('MONTHLY', 'ANNUAL')`),
    // The panel never reports a negative balance. If one ever arrives, the
    // scrape misread the page and the whole row is suspect.
    check("source_account_credit_points_check", sql`${table.points} >= 0`),
  ],
);

/**
 * One recharge against the supplier's panel, and the record that makes it safe
 * to retry. See `recharge-attempt.ts` for the protocol; this is the durable
 * half of it.
 *
 * The row exists BEFORE the click, which is the entire reason it exists at
 * all: a process killed mid-click leaves a `SUBMITTED` row behind, and a
 * `SUBMITTED` row means "go verify", never "go retry".
 *
 * `accumulated_before` is the anchor — "Puntos acumulados" as read immediately
 * before the attempt, from a counter the panel only ever increases.
 */
export const rechargeAttempt = pgTable(
  "recharge_attempt",
  {
    id: uuid("id").primaryKey(),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      // RESTRICT, unlike `source_account_credit`'s CASCADE: a balance is a
      // cached number the supplier still holds, but this is the record of
      // money that moved. It outlives any tidying up.
      .references(() => sourceAccount.id, { onDelete: "restrict" }),
    /** The customer account on the panel, as typed into "Cuenta" (a phone). */
    targetAccount: text("target_account").notNull(),
    plan: text("plan").notNull(),
    period: text("period").notNull(),
    points: integer("points").notNull(),
    status: text("status").notNull(),
    accumulatedBefore: integer("accumulated_before").notNull(),
    accumulatedAfter: integer("accumulated_after"),
    failureDetail: text("failure_detail"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => [
    index("recharge_attempt_source_idx").on(table.sourceAccountId, table.createdAt),
    // The recovery queue: everything still awaiting a verdict. Partial, so it
    // stays small forever no matter how much history accumulates.
    index("recharge_attempt_open_idx")
      .on(table.createdAt)
      .where(sql`${table.status} IN ('PENDING', 'SUBMITTED')`),
    check("recharge_attempt_target_check", sql`length(btrim(${table.targetAccount})) > 0`),
    check("recharge_attempt_plan_check", sql`length(btrim(${table.plan})) > 0`),
    check("recharge_attempt_period_check", sql`${table.period} IN ('MONTHLY', 'ANNUAL')`),
    check("recharge_attempt_points_check", sql`${table.points} >= 1`),
    check(
      "recharge_attempt_status_check",
      sql`${table.status} IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'UNVERIFIED')`,
    ),
    check("recharge_attempt_anchor_check", sql`${table.accumulatedBefore} >= 0`),
    check(
      "recharge_attempt_after_check",
      sql`${table.accumulatedAfter} IS NULL OR ${table.accumulatedAfter} >= 0`,
    ),
    // Open exactly while unsettled.
    check(
      "recharge_attempt_settled_check",
      sql`(${table.status} IN ('PENDING', 'SUBMITTED')) = (${table.settledAt} IS NULL)`,
    ),
    check(
      "recharge_attempt_submitted_check",
      sql`${table.status} <> 'SUBMITTED' OR ${table.submittedAt} IS NOT NULL`,
    ),
    // THE DEFINITIONS THEMSELVES, enforced rather than trusted. "Confirmed"
    // MEANS the counter moved by exactly the points asked for, and "failed"
    // MEANS it did not move at all. Code that ever writes either status
    // without the matching arithmetic is wrong, and this is where it finds out
    // — not three weeks later when somebody audits a customer's balance.
    check(
      "recharge_attempt_confirmed_check",
      sql`${table.status} <> 'CONFIRMED' OR ${table.accumulatedAfter} = ${table.accumulatedBefore} + ${table.points}`,
    ),
    check(
      "recharge_attempt_failed_check",
      sql`${table.status} <> 'FAILED' OR ${table.accumulatedAfter} = ${table.accumulatedBefore}`,
    ),
    // An unverifiable attempt with no reason is a row nobody can act on.
    check(
      "recharge_attempt_unverified_check",
      sql`${table.status} <> 'UNVERIFIED' OR length(btrim(coalesce(${table.failureDetail}, ''))) > 0`,
    ),
  ],
);
