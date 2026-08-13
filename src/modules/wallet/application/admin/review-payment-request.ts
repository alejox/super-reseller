import type { UserId } from "../../domain/ids";
import type { PaymentRequest } from "../../domain/payment-request";
import type { PaymentRequestRepository } from "../../domain/payment-request-repository";
import type { WalletEntry } from "../../domain/wallet-entry";

/**
 * ADMIN use case: decide a payment claim.
 *
 * THIS is where money enters the platform — the only place, now that
 * `topUpBalance` is gone. Approving appends the credit and flips the status in
 * one transaction; rejecting appends nothing at all, because there was never a
 * credit to reverse.
 */

export type ReviewPaymentRequestDeps = Readonly<{
  paymentRequests: Pick<PaymentRequestRepository, "approve" | "reject">;
  /** The reviewer. Backlog A10: a decision nobody signed cannot be audited. */
  actorId: UserId;
}>;

export type ApproveResult =
  | Readonly<{ ok: true; request: PaymentRequest; entry: WalletEntry }>
  | Readonly<{ ok: false; reason: "not-actionable" | "reference-taken" }>;

export type RejectResult =
  | Readonly<{ ok: true; request: PaymentRequest }>
  | Readonly<{ ok: false; reason: "not-actionable" | "reason-required" }>;

/**
 * One reason, not four.
 *
 * "Does not exist", "already approved", "already rejected" and "belongs to a
 * tenant you cannot see" collapse into `not-actionable` on purpose: told
 * apart, they answer "is this a real request id?" for anyone who can reach the
 * endpoint. The distinction the caller actually needs — did my action take
 * effect — survives intact. Same rule as `review-withdrawal.ts`.
 */
export async function approvePayment(
  deps: ReviewPaymentRequestDeps,
  input: Readonly<{ requestId: string; note: string | null }>,
): Promise<ApproveResult> {
  const trimmed = input.note?.trim() ?? "";

  return deps.paymentRequests.approve(
    input.requestId,
    deps.actorId,
    // A nullable column must not carry two spellings of absent.
    trimmed === "" ? null : trimmed,
  );
}

export async function rejectPayment(
  deps: ReviewPaymentRequestDeps,
  input: Readonly<{ requestId: string; reason: string }>,
): Promise<RejectResult> {
  const reason = input.reason.trim();
  if (reason === "") {
    // Checked here rather than left to the database CHECK: the operator is
    // owed a message, not a 500. A rejection is the one outcome the reseller
    // will argue about, and the person answering them is not always the one
    // who clicked the button.
    return { ok: false, reason: "reason-required" };
  }

  const request = await deps.paymentRequests.reject(input.requestId, deps.actorId, reason);

  return request === null ? { ok: false, reason: "not-actionable" } : { ok: true, request };
}
