import type { SourceAccountId } from "../domain/ids";
import type { RechargeAttempt, RechargeAttemptId } from "../domain/recharge-attempt";
import type { RechargeAttemptRepository } from "../domain/recharge-attempt-repository";

export class InMemoryRechargeAttemptStore {
  readonly attempts = new Map<RechargeAttemptId, RechargeAttempt>();
}

const newestFirst = (a: RechargeAttempt, b: RechargeAttempt): number =>
  b.createdAt.getTime() - a.createdAt.getTime();

export class InMemoryRechargeAttemptRepository implements RechargeAttemptRepository {
  constructor(private readonly store: InMemoryRechargeAttemptStore) {}

  async save(attempt: RechargeAttempt): Promise<RechargeAttempt> {
    this.store.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async get(id: RechargeAttemptId): Promise<RechargeAttempt | null> {
    return this.store.attempts.get(id) ?? null;
  }

  async listOpen(sourceAccountId?: SourceAccountId): Promise<readonly RechargeAttempt[]> {
    return [...this.store.attempts.values()]
      .filter(
        (attempt) =>
          (attempt.status === "PENDING" || attempt.status === "SUBMITTED") &&
          (sourceAccountId === undefined || attempt.sourceAccountId === sourceAccountId),
      )
      .sort(newestFirst);
  }

  async listUnverified(): Promise<readonly RechargeAttempt[]> {
    return [...this.store.attempts.values()]
      .filter((attempt) => attempt.status === "UNVERIFIED")
      .sort(newestFirst);
  }

  async listRecent(
    sourceAccountId: SourceAccountId,
    limit: number,
  ): Promise<readonly RechargeAttempt[]> {
    return [...this.store.attempts.values()]
      .filter((attempt) => attempt.sourceAccountId === sourceAccountId)
      .sort(newestFirst)
      .slice(0, limit);
  }
}
