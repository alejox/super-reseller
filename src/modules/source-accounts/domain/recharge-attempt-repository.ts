import type { SourceAccountId } from "./ids";
import type { RechargeAttempt, RechargeAttemptId } from "./recharge-attempt";

/**
 * Where recharge attempts are written down.
 *
 * `save` is an UPSERT and is called THREE times per recharge — at PENDING, at
 * SUBMITTED, and at the verdict. That is not chattiness, it is the durability
 * the protocol is built on: each write is the record that survives the crash
 * which might happen immediately after it.
 *
 * There is no `delete`. An attempt nobody could verify is precisely the row a
 * human needs to find tomorrow.
 */
export interface RechargeAttemptRepository {
  save(attempt: RechargeAttempt): Promise<RechargeAttempt>;

  get(id: RechargeAttemptId): Promise<RechargeAttempt | null>;

  /**
   * Attempts left hanging: `PENDING` or `SUBMITTED`, newest first.
   *
   * This is the recovery queue. A `SUBMITTED` row means the click may have
   * landed and nobody checked — it must be VERIFIED, never blindly retried.
   */
  listOpen(sourceAccountId?: SourceAccountId): Promise<readonly RechargeAttempt[]>;

  /** Everything a human still has to resolve, newest first. */
  listUnverified(): Promise<readonly RechargeAttempt[]>;

  /** Recent history for one supplier login, newest first. */
  listRecent(sourceAccountId: SourceAccountId, limit: number): Promise<readonly RechargeAttempt[]>;
}
