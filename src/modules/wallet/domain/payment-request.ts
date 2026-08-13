import { InvalidMoneyError, money, type CurrencyCode } from "@/shared/money/money";

import type { ResellerId, UserId, WalletEntryId } from "./ids";

/**
 * A claim that money arrived off-platform, waiting to be validated.
 *
 * THE CREDIT HAPPENS WHEN THE REQUEST IS APPROVED, NOT WHEN IT IS MADE.
 *
 * This is deliberately the MIRROR IMAGE of `withdrawal-request.ts`, which
 * debits at request time, and the asymmetry is the point:
 *
 *   - A withdrawal moves money the reseller ALREADY HAS. Waiting until
 *     approval lets five concurrent requests each read the same untouched
 *     balance and each pass the funds check. So it reserves immediately.
 *
 *   - A top-up moves money the operator has NOT YET CONFIRMED RECEIVING.
 *     There is nothing to reserve and nothing to race for: crediting on
 *     submission is not "optimistic", it is handing out balance against an
 *     unverified transfer. That was the previous behaviour of
 *     `topUpBalance` and it is the bug this entity exists to remove.
 *
 * The row is NOT the money. `walletEntryId` is NULL until approval and points
 * at the credit afterwards, so "was this approved" and "did the balance move"
 * are the same fact stored once. A rejection appends nothing at all — there is
 * no debit to reverse, because there was never a credit.
 */

export type PaymentRequestId = string;

/**
 * `PENDING` -> `APPROVED` | `REJECTED`, and nothing else. Both decisions are
 * terminal: reopening an approved request would mean crediting twice, and the
 * ledger has no way to un-append. A mistaken approval is corrected the way
 * every other mistake in this ledger is — a new `ADJUSTMENT` entry.
 */
export type PaymentRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * How the operator says the money arrived. `text` + CHECK rather than a
 * Postgres enum, for the same reason `wallet_entry.kind` is: an enum value can
 * never be removed once shipped, and this list is going to change as payment
 * rails come and go.
 *
 * This is the payment RAIL, not a gateway integration. Nothing here talks to
 * an API — a human received a transfer and is recording which way it came.
 */
export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "NEQUI",
  "DAVIPLATA",
  "BINANCE_PAY",
  "CASH",
  "OTHER",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export class PaymentRequestNotPendingError extends Error {
  constructor(
    public readonly requestId: PaymentRequestId,
    public readonly status: PaymentRequestStatus,
  ) {
    super(`Payment request ${requestId} is ${status}, not PENDING.`);
    this.name = "PaymentRequestNotPendingError";
  }
}

export type PaymentRequest = Readonly<{
  id: PaymentRequestId;
  resellerId: ResellerId;
  /**
   * POSITIVE: how much is being claimed. The wallet entry it points at once
   * approved carries the sign, exactly like `withdrawal_request.amountMinor`.
   */
  amountMinor: number;
  currency: CurrencyCode;
  /** The operator-visible payment rail. */
  method: PaymentMethod;
  /**
   * The bank/transfer reference. This is the ONLY link back to the real-world
   * payment, which is why it is required and why it is unique among approved
   * requests — see `referenceKey`.
   */
  reference: string;
  /** Link to the receipt image. Required: a claim with no proof is a rumour. */
  proofUrl: string;
  status: PaymentRequestStatus;
  /** The credit this request produced. NULL until — and unless — approved. */
  walletEntryId: WalletEntryId | null;
  /** Who submitted the claim. */
  createdBy: UserId;
  createdAt: Date;
  /** Who decided it, and when. NULL while PENDING. */
  reviewedBy: UserId | null;
  reviewedAt: Date | null;
  /**
   * Why it was decided that way. REQUIRED on rejection: "your payment was
   * refused" with no reason is a support ticket the operator cannot answer.
   */
  decisionNote: string | null;
}>;

export type NewPaymentRequestInput = Readonly<{
  resellerId: ResellerId;
  amountMinor: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  reference: string;
  proofUrl: string;
  createdBy: UserId;
  createdAt?: Date;
}>;

/**
 * The comparison key for reference uniqueness.
 *
 * `lower(trim(...))`, matching the partial unique index on the table exactly.
 * If these two ever disagree, the application check passes and the INSERT
 * throws — so they are written to be read side by side.
 */
export function referenceKey(reference: string): string {
  return reference.trim().toLowerCase();
}

export function createPaymentRequest(input: NewPaymentRequestInput): PaymentRequest {
  // Reuses shared/money's guard: rejects non-integers and malformed currency
  // codes before an amount reaches the database.
  money(input.amountMinor, input.currency);

  if (input.amountMinor <= 0) {
    throw new InvalidMoneyError("A payment request must claim a positive amount.");
  }

  const reference = input.reference.trim();
  if (reference === "") {
    throw new InvalidMoneyError("A payment request must carry a payment reference.");
  }

  const proofUrl = input.proofUrl.trim();
  if (proofUrl === "") {
    throw new InvalidMoneyError("A payment request must carry proof of payment.");
  }

  return Object.freeze({
    id: crypto.randomUUID(),
    resellerId: input.resellerId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    method: input.method,
    reference,
    proofUrl,
    status: "PENDING" as const,
    walletEntryId: null,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
    reviewedBy: null,
    reviewedAt: null,
    decisionNote: null,
  });
}

/**
 * `walletEntryId` is a REQUIRED argument, not something a caller may forget:
 * an approval whose credit never landed is a reseller told their money arrived
 * while their balance says otherwise. The type is the cheapest place to make
 * that impossible to express — the same trick `rejectWithdrawal` plays with
 * its reversal entry.
 */
export function approvePaymentRequest(
  request: PaymentRequest,
  reviewedBy: UserId,
  at: Date,
  walletEntryId: WalletEntryId,
  note: string | null,
): PaymentRequest {
  if (request.status !== "PENDING") {
    throw new PaymentRequestNotPendingError(request.id, request.status);
  }

  return Object.freeze({
    ...request,
    status: "APPROVED" as const,
    walletEntryId,
    reviewedBy,
    reviewedAt: at,
    decisionNote: note,
  });
}

/**
 * The reason is REQUIRED and non-empty. A rejection is the one outcome the
 * reseller will argue about, and the operator who has to answer them is not
 * always the one who clicked the button.
 */
export function rejectPaymentRequest(
  request: PaymentRequest,
  reviewedBy: UserId,
  at: Date,
  reason: string,
): PaymentRequest {
  if (request.status !== "PENDING") {
    throw new PaymentRequestNotPendingError(request.id, request.status);
  }

  const trimmed = reason.trim();
  if (trimmed === "") {
    throw new InvalidMoneyError("A rejected payment request must record why.");
  }

  return Object.freeze({
    ...request,
    status: "REJECTED" as const,
    // Untouched, and that is the whole point: a rejection moves no money, so
    // there is no entry to point at and nothing to reverse.
    walletEntryId: null,
    reviewedBy,
    reviewedAt: at,
    decisionNote: trimmed,
  });
}
