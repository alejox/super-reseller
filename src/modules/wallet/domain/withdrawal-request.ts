import { InvalidMoneyError, money, type CurrencyCode } from "@/shared/money/money";

import type { ResellerId, UserId, WalletEntryId } from "./ids";

/**
 * A reseller taking money OUT of the platform.
 *
 * THE DEBIT HAPPENS WHEN THE REQUEST IS MADE, NOT WHEN IT IS APPROVED.
 *
 * This is the decision the whole module hangs off. Debiting at approval time
 * looks safer and is not: five requests for the full balance would each read
 * the same untouched balance, each pass the funds check, and each be approved
 * by a reviewer who has no way to see the other four. Debiting at request
 * time is what makes the funds actually reserved — the second request reads a
 * balance the first one already reduced.
 *
 * The cost is that a REJECTED request has to give the money back. It does so
 * the only way this ledger allows: a NEW entry with the opposite sign,
 * recorded here as `reversalEntryId`. Nothing is ever updated or deleted, so
 * the request and its reversal both stay visible — which is exactly what an
 * auditor asking "why did this reseller's balance move twice" needs to see.
 */

export type WithdrawalRequestId = string;
export type WithdrawalMethodId = string;

/**
 * `PENDING_REVIEW` -> `APPROVED` | `REJECTED`, and `APPROVED` -> `PAID`.
 *
 * A small request skips straight to `APPROVED`: its funds are already
 * debited, and there is nothing for a human to decide. `PAID` means the
 * transfer actually left the operator's bank — an off-platform fact somebody
 * has to confirm, which is why it is a separate state and not a synonym for
 * approval.
 */
export type WithdrawalStatus = "PENDING_REVIEW" | "APPROVED" | "PAID" | "REJECTED";

/**
 * Above this, a human signs off before the money moves.
 *
 * $1.000.000 COP. The wallet mints COP (`WALLET_CURRENCY`), and COP's
 * smallest practical unit is the PESO, not a cent — `formatMoney` resolves it
 * to 0 fraction digits. So this is one million pesos, NOT ten thousand of
 * anything. The screen that used to promise "$10,000 USD" was written against
 * a currency this ledger never held.
 *
 * It is a constant rather than a per-reseller setting on purpose:
 * `withdrawal_settings` is configured BY the reseller, so a threshold living
 * there would be one the reseller could raise on itself — a fraud control the
 * controlled party can switch off is not a control.
 */
export const MANUAL_REVIEW_THRESHOLD_MINOR = 1_000_000;

export class WithdrawalNotUnderReviewError extends Error {
  constructor(
    public readonly requestId: WithdrawalRequestId,
    public readonly status: WithdrawalStatus,
  ) {
    super(`Withdrawal ${requestId} is ${status}, not PENDING_REVIEW.`);
    this.name = "WithdrawalNotUnderReviewError";
  }
}

export class WithdrawalNotApprovedError extends Error {
  constructor(
    public readonly requestId: WithdrawalRequestId,
    public readonly status: WithdrawalStatus,
  ) {
    super(`Withdrawal ${requestId} is ${status}, not APPROVED.`);
    this.name = "WithdrawalNotApprovedError";
  }
}

export type WithdrawalRequest = Readonly<{
  id: WithdrawalRequestId;
  resellerId: ResellerId;
  /** Where the money is being sent. Resolved and owner-checked before this. */
  methodId: WithdrawalMethodId;
  /**
   * POSITIVE: how much was asked for. The wallet entry this points at holds
   * the negative amount. One fact, one sign, in one place — two signed copies
   * is how a statement ends up double-counting a withdrawal.
   */
  amountMinor: number;
  currency: CurrencyCode;
  status: WithdrawalStatus;
  /** The debit that reserved the funds. Never null: no request without it. */
  walletEntryId: WalletEntryId;
  /** The compensating credit, set only when the request is REJECTED. */
  reversalEntryId: WalletEntryId | null;
  requestedBy: UserId;
  reviewedBy: UserId | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  settledAt: Date | null;
  note: string | null;
}>;

export type NewWithdrawalRequestInput = Readonly<{
  resellerId: ResellerId;
  methodId: WithdrawalMethodId;
  amountMinor: number;
  currency: CurrencyCode;
  walletEntryId: WalletEntryId;
  requestedBy: UserId;
  requestedAt?: Date;
}>;

export function requiresManualReview(amountMinor: number): boolean {
  return amountMinor >= MANUAL_REVIEW_THRESHOLD_MINOR;
}

export function initialStatusFor(amountMinor: number): WithdrawalStatus {
  return requiresManualReview(amountMinor) ? "PENDING_REVIEW" : "APPROVED";
}

export function createWithdrawalRequest(input: NewWithdrawalRequestInput): WithdrawalRequest {
  // Reuses shared/money's guard: rejects non-integers and malformed currency
  // codes before an amount reaches the ledger.
  money(input.amountMinor, input.currency);

  if (input.amountMinor <= 0) {
    throw new InvalidMoneyError(
      "A withdrawal must move a positive amount; the wallet entry carries the sign.",
    );
  }

  return Object.freeze({
    id: crypto.randomUUID(),
    resellerId: input.resellerId,
    methodId: input.methodId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    status: initialStatusFor(input.amountMinor),
    walletEntryId: input.walletEntryId,
    reversalEntryId: null,
    requestedBy: input.requestedBy,
    reviewedBy: null,
    requestedAt: input.requestedAt ?? new Date(),
    reviewedAt: null,
    settledAt: null,
    note: null,
  });
}

export function approveWithdrawal(
  request: WithdrawalRequest,
  reviewedBy: UserId,
  at: Date,
  note: string | null,
): WithdrawalRequest {
  if (request.status !== "PENDING_REVIEW") {
    throw new WithdrawalNotUnderReviewError(request.id, request.status);
  }

  return Object.freeze({ ...request, status: "APPROVED" as const, reviewedBy, reviewedAt: at, note });
}

/**
 * `reversalEntryId` is a REQUIRED argument, not something a caller may
 * forget: a rejection whose money never came back is a reseller silently
 * short the full amount, and the type is the cheapest place to make that
 * impossible to express.
 */
export function rejectWithdrawal(
  request: WithdrawalRequest,
  reviewedBy: UserId,
  at: Date,
  note: string | null,
  reversalEntryId: WalletEntryId,
): WithdrawalRequest {
  if (request.status !== "PENDING_REVIEW") {
    throw new WithdrawalNotUnderReviewError(request.id, request.status);
  }

  return Object.freeze({
    ...request,
    status: "REJECTED" as const,
    reviewedBy,
    reviewedAt: at,
    reversalEntryId,
    note,
  });
}

/**
 * Refuses anything that is not APPROVED — including an already-PAID request.
 * Paying twice is the most expensive bug this module can have: the ledger was
 * debited once, so the second transfer is money gone with nothing recording
 * it.
 */
export function settleWithdrawal(
  request: WithdrawalRequest,
  at: Date,
  note: string | null,
): WithdrawalRequest {
  if (request.status !== "APPROVED") {
    throw new WithdrawalNotApprovedError(request.id, request.status);
  }

  return Object.freeze({ ...request, status: "PAID" as const, settledAt: at, note });
}
