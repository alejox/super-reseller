import type { CurrencyCode } from "@/shared/money/money";

import type { ResellerId, UserId } from "./ids";
import type {
  WithdrawalMethodId,
  WithdrawalRequest,
  WithdrawalRequestId,
} from "./withdrawal-request";

export type OpenWithdrawalCommand = Readonly<{
  resellerId: ResellerId;
  methodId: WithdrawalMethodId;
  /** POSITIVE. The adapter writes the negative wallet entry. */
  amountMinor: number;
  currency: CurrencyCode;
  requestedBy: UserId;
  /**
   * Passed in rather than read by the adapter: the caller has already loaded
   * the reseller's settings to enforce the minimum, and re-reading them here
   * would let the two checks disagree about the same row.
   */
  maxDailyWithdrawalMinor: number;
}>;

export type OpenWithdrawalOutcome =
  | Readonly<{ ok: true; request: WithdrawalRequest }>
  | Readonly<{ ok: false; reason: "insufficient-funds"; balanceMinor: number }>
  | Readonly<{
      ok: false;
      reason: "daily-limit-exceeded";
      withdrawnTodayMinor: number;
      limitMinor: number;
    }>;

/**
 * The withdrawal port.
 *
 * `openRequest` is ONE operation for the same reason `placeOrder` is: it
 * reads the balance, refuses if short, debits the wallet and records the
 * request, and all four either happen or none does. Split in two, the failure
 * modes are "debited but no request" — money vanished with nothing to point
 * at — and "request but no debit", which is the drain this design exists to
 * prevent.
 *
 * `reject` is transactional for the mirror reason: it appends the
 * compensating credit AND flips the status. A reversal without the status
 * change pays the reseller back twice on the next attempt.
 */
export interface WithdrawalRequestRepository {
  openRequest(command: OpenWithdrawalCommand): Promise<OpenWithdrawalOutcome>;

  /** Requests visible to the current scope, newest first. */
  listRequests(resellerId?: ResellerId): Promise<readonly WithdrawalRequest[]>;

  getRequest(id: WithdrawalRequestId): Promise<WithdrawalRequest | null>;

  /**
   * The three below return `null` when no request in the expected state
   * matches — already reviewed, already paid, or belonging to someone else
   * are the same answer: nothing to do. Same convention as
   * `OrderingRepository.fulfilOrder`.
   */
  approve(
    id: WithdrawalRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<WithdrawalRequest | null>;

  reject(
    id: WithdrawalRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<WithdrawalRequest | null>;

  settle(id: WithdrawalRequestId, note: string | null): Promise<WithdrawalRequest | null>;
}
