import { and, desc, eq, sql } from "drizzle-orm";

import type { ModuleDb } from "@/shared/db/module-db";
import type { AccessScope } from "@/modules/identity/domain/access-scope";
import { tenantWhere } from "@/shared/db/tenant";

import type { ResellerId, UserId } from "../domain/ids";
import type {
  OpenWithdrawalCommand,
  OpenWithdrawalOutcome,
  WithdrawalRequestRepository,
} from "../domain/withdrawal-request-repository";
import {
  initialStatusFor,
  type WithdrawalRequest,
  type WithdrawalRequestId,
  type WithdrawalStatus,
} from "../domain/withdrawal-request";
import { walletEntry, withdrawalRequest } from "./wallet.schema";

type Row = typeof withdrawalRequest.$inferSelect;

function toDomain(row: Row): WithdrawalRequest {
  return Object.freeze({
    ...row,
    amountMinor: Number(row.amountMinor),
    status: row.status as WithdrawalStatus,
  });
}

/**
 * Drizzle-backed withdrawals, scoped at construction like every other
 * adapter here.
 */
export class DrizzleWithdrawalRequestRepository implements WithdrawalRequestRepository {
  constructor(
    private readonly db: ModuleDb,
    private readonly scope: AccessScope,
  ) {}

  /**
   * Daily-cap check, balance check, debit and request insert as ONE
   * transaction, under the same advisory lock `placeOrder` takes.
   *
   * The lock is what makes both checks trustworthy. Without it, two
   * concurrent withdrawals read the same balance and the same day's total
   * under READ COMMITTED — neither sees the other's uncommitted debit — and
   * both pass a check that only one should. This is worse here than in
   * ordering: an order that overdraws leaves a product owed, a withdrawal
   * that overdraws leaves money already transferred out of the business.
   *
   * `pg_advisory_xact_lock(hashtext(reseller_id))` and NOT `SELECT ... FOR
   * UPDATE`: a row lock locks ROWS THAT EXIST, so on a reseller with no
   * ledger rows yet it would lock nothing and silently succeed. It hashes
   * the SAME key ordering uses, deliberately — a withdrawal and an order
   * racing on one reseller's balance must serialize against each other, not
   * just against their own kind.
   */
  async openRequest(command: OpenWithdrawalCommand): Promise<OpenWithdrawalOutcome> {
    const requestId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    const now = new Date();

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${command.resellerId}))`);

      const balanceResult = await tx.execute<{ balance: number } & Record<string, unknown>>(
        sql`SELECT coalesce(sum(amount_minor), 0)::bigint AS balance FROM wallet_entry WHERE reseller_id = ${command.resellerId}`,
      );
      const balanceMinor = Number(balanceResult.rows[0]?.balance ?? 0);

      if (balanceMinor < command.amountMinor) {
        // Refusing INSIDE the transaction is what makes the check mean
        // something: the lock is still held, so no concurrent withdrawal can
        // have spent the difference between reading and deciding.
        return { ok: false, reason: "insufficient-funds", balanceMinor } as const;
      }

      // Computed in the database and not in JS: the cap is a database fact,
      // and an app server whose clock or timezone drifts would move the
      // window under it.
      //
      // BOTH `AT TIME ZONE 'UTC'` are load-bearing. The inner one turns
      // `now()` into the UTC wall clock; `date_trunc` then gives UTC midnight
      // as a timestamp WITHOUT a zone. Comparing that against `requested_at`
      // (a `timestamptz`) makes Postgres cast it back using the SESSION
      // timezone — so with the session in Bogotá (UTC-5), between 19:00 and
      // midnight local the UTC date has already rolled over and the boundary
      // lands five hours in the FUTURE. Nothing from today counts, the cap
      // resets, and a reseller withdraws twice the daily maximum. The outer
      // `AT TIME ZONE 'UTC'` pins the boundary back to a real instant, so the
      // window is a UTC day whatever the session is set to.
      const todayResult = await tx.execute<{ total: number } & Record<string, unknown>>(
        sql`SELECT coalesce(sum(amount_minor), 0)::bigint AS total
            FROM withdrawal_request
            WHERE reseller_id = ${command.resellerId}
              AND status <> 'REJECTED'
              AND requested_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
      );
      const withdrawnTodayMinor = Number(todayResult.rows[0]?.total ?? 0);

      if (withdrawnTodayMinor + command.amountMinor > command.maxDailyWithdrawalMinor) {
        return {
          ok: false,
          reason: "daily-limit-exceeded",
          withdrawnTodayMinor,
          limitMinor: command.maxDailyWithdrawalMinor,
        } as const;
      }

      await tx.insert(walletEntry).values({
        id: entryId,
        resellerId: command.resellerId,
        kind: "WITHDRAWAL",
        // NEGATIVE: the money is reserved the moment the request opens, not
        // when a reviewer gets to it.
        amountMinor: -command.amountMinor,
        currency: command.currency,
        memo: null,
        createdBy: command.requestedBy,
        createdAt: now,
      });

      const [row] = await tx
        .insert(withdrawalRequest)
        .values({
          id: requestId,
          resellerId: command.resellerId,
          methodId: command.methodId,
          amountMinor: command.amountMinor,
          currency: command.currency,
          status: initialStatusFor(command.amountMinor),
          walletEntryId: entryId,
          reversalEntryId: null,
          requestedBy: command.requestedBy,
          reviewedBy: null,
          requestedAt: now,
          reviewedAt: null,
          settledAt: null,
          note: null,
        })
        .returning();

      return { ok: true, request: toDomain(row) } as const;
    });
  }

  async listRequests(resellerId?: ResellerId): Promise<readonly WithdrawalRequest[]> {
    const rows = await this.db
      .select()
      .from(withdrawalRequest)
      .where(
        and(
          tenantWhere(withdrawalRequest, this.scope),
          resellerId ? eq(withdrawalRequest.resellerId, resellerId) : undefined,
        ),
      )
      .orderBy(desc(withdrawalRequest.requestedAt));

    return rows.map(toDomain);
  }

  async getRequest(id: WithdrawalRequestId): Promise<WithdrawalRequest | null> {
    const [row] = await this.db
      .select()
      .from(withdrawalRequest)
      .where(and(tenantWhere(withdrawalRequest, this.scope), eq(withdrawalRequest.id, id)));

    return row ? toDomain(row) : null;
  }

  /**
   * `status = 'PENDING_REVIEW'` in the WHERE, not just checked beforehand:
   * two concurrent approvals would both pass a read-then-write, and only one
   * should win. The second matches no row and returns `null`.
   */
  async approve(
    id: WithdrawalRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<WithdrawalRequest | null> {
    const [row] = await this.db
      .update(withdrawalRequest)
      .set({ status: "APPROVED", reviewedBy, reviewedAt: new Date(), note })
      .where(
        and(
          tenantWhere(withdrawalRequest, this.scope),
          eq(withdrawalRequest.id, id),
          eq(withdrawalRequest.status, "PENDING_REVIEW"),
        ),
      )
      .returning();

    return row ? toDomain(row) : null;
  }

  /**
   * The reversal entry and the status change are ONE transaction. A credit
   * without the status flip lets the next rejection attempt credit the
   * reseller a second time — money it never had.
   */
  async reject(
    id: WithdrawalRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<WithdrawalRequest | null> {
    const reversalId = crypto.randomUUID();
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(withdrawalRequest)
        .where(
          and(
            tenantWhere(withdrawalRequest, this.scope),
            eq(withdrawalRequest.id, id),
            eq(withdrawalRequest.status, "PENDING_REVIEW"),
          ),
        )
        // Holds the row against a concurrent approval for the rest of the
        // transaction. Unlike the balance check in `openRequest`, the row is
        // guaranteed to exist here — the SELECT just found it — so a row lock
        // is the right tool and an advisory lock would be overkill.
        .for("update");

      if (!existing) return null;

      await tx.insert(walletEntry).values({
        id: reversalId,
        resellerId: existing.resellerId,
        kind: "WITHDRAWAL",
        // POSITIVE: the debit is never undone, the money comes back as a new
        // movement, and both stay on the statement.
        amountMinor: Number(existing.amountMinor),
        currency: existing.currency,
        memo: `Reversal of withdrawal ${existing.id}`,
        createdBy: reviewedBy,
        createdAt: now,
      });

      const [row] = await tx
        .update(withdrawalRequest)
        .set({
          status: "REJECTED",
          reviewedBy,
          reviewedAt: now,
          reversalEntryId: reversalId,
          note,
        })
        .where(eq(withdrawalRequest.id, id))
        .returning();

      return row ? toDomain(row) : null;
    });
  }

  async settle(id: WithdrawalRequestId, note: string | null): Promise<WithdrawalRequest | null> {
    const [row] = await this.db
      .update(withdrawalRequest)
      .set({ status: "PAID", settledAt: new Date(), note })
      // Only an APPROVED request can be paid, enforced in the WHERE so that
      // two concurrent settlements cannot both transfer. Paying twice is the
      // most expensive bug this module has.
      .where(
        and(
          tenantWhere(withdrawalRequest, this.scope),
          eq(withdrawalRequest.id, id),
          eq(withdrawalRequest.status, "APPROVED"),
        ),
      )
      .returning();

    return row ? toDomain(row) : null;
  }
}
