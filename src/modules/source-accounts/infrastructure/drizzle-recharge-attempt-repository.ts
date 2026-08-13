import { and, desc, eq, inArray } from "drizzle-orm";

import type { ModuleDb } from "@/shared/db/module-db";

import type { SourceAccountId } from "../domain/ids";
import type {
  RechargeAttempt,
  RechargeAttemptId,
  RechargeAttemptStatus,
} from "../domain/recharge-attempt";
import type { RechargeAttemptRepository } from "../domain/recharge-attempt-repository";
import type { CreditPeriod } from "../domain/source-account";
import { rechargeAttempt } from "./source-account.schema";

/**
 * Drizzle-backed recharge attempts.
 *
 * ADMIN-only by composition root, like the rest of this module — the table has
 * no `reseller_id` to scope by because a recharge is drawn against the
 * platform's own supplier login.
 *
 * `save` is a plain upsert on the primary key. The protocol calls it three
 * times per recharge and each call must land before the next step runs; that
 * is the durability the whole design rests on, not chattiness to optimise
 * away.
 */

const OPEN_STATUSES: readonly RechargeAttemptStatus[] = ["PENDING", "SUBMITTED"];

type Row = typeof rechargeAttempt.$inferSelect;

function toDomain(row: Row): RechargeAttempt {
  return Object.freeze({
    id: row.id,
    sourceAccountId: row.sourceAccountId,
    targetAccount: row.targetAccount,
    plan: row.plan,
    period: row.period as CreditPeriod,
    points: row.points,
    status: row.status as RechargeAttemptStatus,
    accumulatedBefore: row.accumulatedBefore,
    accumulatedAfter: row.accumulatedAfter,
    failureDetail: row.failureDetail,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    settledAt: row.settledAt,
  });
}

export class DrizzleRechargeAttemptRepository implements RechargeAttemptRepository {
  constructor(private readonly db: ModuleDb) {}

  async save(attempt: RechargeAttempt): Promise<RechargeAttempt> {
    const values = {
      id: attempt.id,
      sourceAccountId: attempt.sourceAccountId,
      targetAccount: attempt.targetAccount,
      plan: attempt.plan,
      period: attempt.period,
      points: attempt.points,
      status: attempt.status,
      accumulatedBefore: attempt.accumulatedBefore,
      accumulatedAfter: attempt.accumulatedAfter,
      failureDetail: attempt.failureDetail,
      createdBy: attempt.createdBy,
      createdAt: attempt.createdAt,
      submittedAt: attempt.submittedAt,
      settledAt: attempt.settledAt,
    };

    const [row] = await this.db
      .insert(rechargeAttempt)
      .values(values)
      .onConflictDoUpdate({
        target: rechargeAttempt.id,
        // Only the fields the state machine moves. The anchor, the target and
        // the amount are written once at PENDING and must never be rewritten —
        // an anchor that could change is not an anchor.
        set: {
          status: values.status,
          accumulatedAfter: values.accumulatedAfter,
          failureDetail: values.failureDetail,
          submittedAt: values.submittedAt,
          settledAt: values.settledAt,
        },
      })
      .returning();

    return toDomain(row);
  }

  async get(id: RechargeAttemptId): Promise<RechargeAttempt | null> {
    const [row] = await this.db
      .select()
      .from(rechargeAttempt)
      .where(eq(rechargeAttempt.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async listOpen(sourceAccountId?: SourceAccountId): Promise<readonly RechargeAttempt[]> {
    const openOnly = inArray(rechargeAttempt.status, [...OPEN_STATUSES]);

    const rows = await this.db
      .select()
      .from(rechargeAttempt)
      .where(
        sourceAccountId === undefined
          ? openOnly
          : and(openOnly, eq(rechargeAttempt.sourceAccountId, sourceAccountId)),
      )
      .orderBy(desc(rechargeAttempt.createdAt));

    return rows.map(toDomain);
  }

  async listUnverified(): Promise<readonly RechargeAttempt[]> {
    const rows = await this.db
      .select()
      .from(rechargeAttempt)
      .where(eq(rechargeAttempt.status, "UNVERIFIED"))
      .orderBy(desc(rechargeAttempt.createdAt));

    return rows.map(toDomain);
  }

  async listRecent(
    sourceAccountId: SourceAccountId,
    limit: number,
  ): Promise<readonly RechargeAttempt[]> {
    const rows = await this.db
      .select()
      .from(rechargeAttempt)
      .where(eq(rechargeAttempt.sourceAccountId, sourceAccountId))
      .orderBy(desc(rechargeAttempt.createdAt))
      .limit(limit);

    return rows.map(toDomain);
  }
}
