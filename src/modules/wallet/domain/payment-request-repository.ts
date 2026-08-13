import type { CurrencyCode } from "@/shared/money/money";

import type { ResellerId, UserId } from "./ids";
import type { PaymentMethod, PaymentRequest, PaymentRequestId, PaymentRequestStatus } from "./payment-request";
import type { WalletEntry } from "./wallet-entry";

/**
 * The payment-validation port.
 *
 * `approve` returns the entry it appended, not just the request: the credit
 * and the status change are ONE transaction in every implementation, and a
 * caller that had to go fetch the entry afterwards could observe a state where
 * only half of it happened.
 *
 * Scoped at construction like every other repository in this module — the
 * reseller id comes from the `AccessScope`, so an unscoped read is not
 * expressible.
 */

export type OpenPaymentRequestCommand = Readonly<{
  resellerId: ResellerId;
  amountMinor: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  reference: string;
  proofUrl: string;
  createdBy: UserId;
}>;

export type OpenPaymentRequestOutcome =
  | Readonly<{ ok: true; request: PaymentRequest }>
  | Readonly<{ ok: false; reason: "reference-taken"; conflictingRequestId: PaymentRequestId }>;

/**
 * `reference-taken` can surface at APPROVAL and not only at submission, and
 * that is not a leak in the design — uniqueness is scoped to APPROVED requests
 * (see the partial index), so two pending claims may legitimately carry the
 * same reference right up until one of them is approved.
 */
export type ApprovePaymentRequestOutcome =
  | Readonly<{ ok: true; request: PaymentRequest; entry: WalletEntry }>
  | Readonly<{ ok: false; reason: "not-actionable" | "reference-taken" }>;

export interface PaymentRequestRepository {
  open(command: OpenPaymentRequestCommand): Promise<OpenPaymentRequestOutcome>;

  /** Newest first. Narrowed by status for the validation inbox. */
  list(status?: PaymentRequestStatus): Promise<readonly PaymentRequest[]>;

  get(id: PaymentRequestId): Promise<PaymentRequest | null>;

  /** Appends the TOPUP credit and flips the status, atomically. */
  approve(
    id: PaymentRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<ApprovePaymentRequestOutcome>;

  /** Moves no money. Returns `null` when the request is not PENDING any more. */
  reject(
    id: PaymentRequestId,
    reviewedBy: UserId,
    reason: string,
  ): Promise<PaymentRequest | null>;

  /**
   * How many requests sit in each status. One grouped query for the header
   * badge, not one `list` per status thrown away after `.length`.
   */
  countByStatus(): Promise<ReadonlyMap<PaymentRequestStatus, number>>;
}
