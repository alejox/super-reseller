import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { ModuleDb } from "@/shared/db/module-db";

import type { SourceAccountId } from "../domain/ids";
import {
  createSourceAccount,
  creditKey,
  type CreditBalance,
  type CreditPeriod,
  type SourceAccount,
  type SourceConnectionStatus,
} from "../domain/source-account";
import type {
  CreateSourceAccountOutcome,
  NewSourceAccountCommand,
  SourceAccountRepository,
  SyncOutcome,
} from "../domain/source-account-repository";
import { sourceAccount, sourceAccountCredit } from "./source-account.schema";

/**
 * Drizzle-backed source accounts.
 *
 * NOT scoped by `tenantWhere`, and it cannot be: the table has no
 * `reseller_id` because the platform owns these rows. The guard is the
 * composition root — every caller reaches this through a deps factory that has
 * already run `requireRole("ADMIN")`, the same trade
 * `DrizzleTopUpSettingsRepository` makes and for the same reason.
 *
 * `recordSync` runs in a TRANSACTION. The status, the clock, the streak and
 * the balance rows are one observation of one page at one instant; a crash
 * between the UPDATE and the balance rewrite would leave the platform claiming
 * a live session while showing the previous session's numbers.
 */

/**
 * Postgres' unique-violation SQLSTATE.
 *
 * WALKS THE `cause` CHAIN, unlike the copy in
 * `drizzle-payment-request-repository.ts`, and the difference is not
 * cosmetic — drizzle surfaces driver errors two different ways:
 *
 *   - out of `db.transaction(...)`, the raw driver error is rethrown, so
 *     `code` sits on the error you catch. That is the only path the wallet
 *     copy takes (its `open` pre-SELECTs for a clash instead of catching),
 *     which is why a top-level check works there and its contract test is
 *     honest.
 *   - out of a plain `.insert()`, it is wrapped in a `DrizzleQueryError`
 *     ("Failed query: ..."), and `code` moves to `error.cause`.
 *
 * This repository takes the second path, so a top-level-only check would
 * rethrow every duplicate as a 500. Walking the chain covers both.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

type Row = typeof sourceAccount.$inferSelect;
type CreditRow = typeof sourceAccountCredit.$inferSelect;

function toDomain(row: Row, credits: readonly CreditRow[]): SourceAccount {
  return Object.freeze({
    id: row.id,
    panelUrl: row.panelUrl,
    panelUsername: row.panelUsername,
    label: row.label,
    connectionStatus: row.connectionStatus as SourceConnectionStatus,
    lastSyncAt: row.lastSyncAt,
    lastSyncError: row.lastSyncError,
    consecutiveFailures: row.consecutiveFailures,
    credits: Object.freeze(
      credits.map((credit) =>
        Object.freeze({
          plan: credit.plan,
          period: credit.period as CreditPeriod,
          points: credit.points,
        }),
      ),
    ),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
  });
}

export class DrizzleSourceAccountRepository implements SourceAccountRepository {
  constructor(private readonly db: ModuleDb) {}

  private async creditsFor(
    accountIds: readonly SourceAccountId[],
  ): Promise<Map<SourceAccountId, CreditRow[]>> {
    const byAccount = new Map<SourceAccountId, CreditRow[]>();
    if (accountIds.length === 0) return byAccount;

    const rows = await this.db
      .select()
      .from(sourceAccountCredit)
      .where(inArray(sourceAccountCredit.sourceAccountId, [...accountIds]));

    for (const row of rows) {
      const list = byAccount.get(row.sourceAccountId) ?? [];
      list.push(row);
      byAccount.set(row.sourceAccountId, list);
    }

    return byAccount;
  }

  async create(command: NewSourceAccountCommand): Promise<CreateSourceAccountOutcome> {
    // The domain constructor validates and mints the id before any SQL runs,
    // so a blank username or url never reaches the database.
    const account = createSourceAccount(command);

    try {
      const [row] = await this.db
        .insert(sourceAccount)
        .values({
          id: account.id,
          panelUrl: account.panelUrl,
          panelUsername: account.panelUsername,
          label: account.label,
          connectionStatus: account.connectionStatus,
          lastSyncAt: account.lastSyncAt,
          lastSyncError: account.lastSyncError,
          consecutiveFailures: account.consecutiveFailures,
          createdBy: account.createdBy,
          createdAt: account.createdAt,
          archivedAt: account.archivedAt,
        })
        .returning();

      return { ok: true, account: toDomain(row, []) };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // The partial unique index fired. Report WHICH account holds the
      // identity — an operator staring at "already registered" needs to be
      // able to go look at the one that took it.
      const [clash] = await this.db
        .select({ id: sourceAccount.id })
        .from(sourceAccount)
        .where(
          and(
            eq(sourceAccount.panelUrl, command.panelUrl.trim()),
            sql`lower(${sourceAccount.panelUsername}) = lower(${command.panelUsername.trim()})`,
            isNull(sourceAccount.archivedAt),
          ),
        )
        .limit(1);

      return { ok: false, reason: "identity-taken", conflictingAccountId: clash?.id ?? "" };
    }
  }

  async list(): Promise<readonly SourceAccount[]> {
    const rows = await this.db
      .select()
      .from(sourceAccount)
      .where(isNull(sourceAccount.archivedAt))
      .orderBy(desc(sourceAccount.createdAt));

    // One query for every account's balances rather than one per row.
    const credits = await this.creditsFor(rows.map((row) => row.id));

    return rows.map((row) => toDomain(row, credits.get(row.id) ?? []));
  }

  async get(id: SourceAccountId): Promise<SourceAccount | null> {
    const [row] = await this.db
      .select()
      .from(sourceAccount)
      .where(eq(sourceAccount.id, id))
      .limit(1);

    if (!row) return null;

    const credits = await this.db
      .select()
      .from(sourceAccountCredit)
      .where(eq(sourceAccountCredit.sourceAccountId, id));

    return toDomain(row, credits);
  }

  async recordSync(
    id: SourceAccountId,
    outcome: SyncOutcome,
    at: Date = new Date(),
  ): Promise<SourceAccount | null> {
    const patch = outcome.ok
      ? {
          connectionStatus: "CONNECTED" as const,
          lastSyncAt: at,
          lastSyncError: null,
          consecutiveFailures: 0,
        }
      : {
          connectionStatus: outcome.reason,
          lastSyncAt: at,
          lastSyncError: outcome.detail?.trim() || null,
          // Incremented in SQL rather than in JS: two workers reading the same
          // counter must not both write "1".
          consecutiveFailures: sql<number>`${sourceAccount.consecutiveFailures} + 1`,
        };

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(sourceAccount)
        .set(patch)
        .where(eq(sourceAccount.id, id))
        .returning();

      if (!row) return null;

      if (!outcome.ok) {
        // The last known balances stay. They are stale, not wrong, and
        // `last_sync_at` already says how stale.
        const credits = await tx
          .select()
          .from(sourceAccountCredit)
          .where(eq(sourceAccountCredit.sourceAccountId, id));

        return toDomain(row, credits);
      }

      // REPLACED, never merged: a bucket the supplier stopped reporting must
      // disappear rather than linger showing points that are no longer there.
      await tx.delete(sourceAccountCredit).where(eq(sourceAccountCredit.sourceAccountId, id));

      // Deduplicated on the same key as `source_account_credit_bucket_uniq`,
      // so a scrape that read one bucket twice is a no-op rather than a
      // constraint violation.
      const byBucket = new Map<string, CreditBalance>(
        outcome.credits.map((balance) => [creditKey(balance.plan, balance.period), balance]),
      );

      const inserted =
        byBucket.size === 0
          ? []
          : await tx
              .insert(sourceAccountCredit)
              .values(
                [...byBucket.values()].map((balance) => ({
                  id: crypto.randomUUID(),
                  sourceAccountId: id,
                  plan: balance.plan,
                  period: balance.period,
                  points: balance.points,
                  syncedAt: at,
                })),
              )
              .returning();

      return toDomain(row, inserted);
    });
  }

  async archive(id: SourceAccountId, at: Date = new Date()): Promise<SourceAccount | null> {
    const [row] = await this.db
      .update(sourceAccount)
      .set({ archivedAt: at })
      .where(eq(sourceAccount.id, id))
      .returning();

    if (!row) return null;

    const credits = await this.db
      .select()
      .from(sourceAccountCredit)
      .where(eq(sourceAccountCredit.sourceAccountId, id));

    return toDomain(row, credits);
  }

  async countByConnectionStatus(): Promise<ReadonlyMap<SourceConnectionStatus, number>> {
    const rows = await this.db
      .select({
        status: sourceAccount.connectionStatus,
        total: sql<number>`count(*)::int`,
      })
      .from(sourceAccount)
      .where(isNull(sourceAccount.archivedAt))
      .groupBy(sourceAccount.connectionStatus);

    return new Map(rows.map((row) => [row.status as SourceConnectionStatus, row.total]));
  }
}
