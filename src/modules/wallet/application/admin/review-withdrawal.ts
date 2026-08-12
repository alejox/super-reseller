import type { UserId } from "../../domain/ids";
import type { WithdrawalRequest } from "../../domain/withdrawal-request";
import type { WithdrawalRequestRepository } from "../../domain/withdrawal-request-repository";

/**
 * ADMIN/finance use cases: decide a withdrawal that went to review, and
 * confirm that an approved one actually left the bank.
 *
 * None of these move money on their own. The debit already happened when the
 * reseller opened the request (see `request-withdrawal.ts`) — approval only
 * releases it, and rejection appends the compensating credit. Anything here
 * that touched the balance a second time would double-charge or double-pay.
 */

export type ReviewWithdrawalDeps = Readonly<{
  withdrawalRequests: Pick<WithdrawalRequestRepository, "approve" | "reject" | "settle">;
  /** The reviewer. A decision nobody signed cannot be audited. */
  actorId: UserId;
}>;

export type ReviewWithdrawalResult =
  | Readonly<{ ok: true; request: WithdrawalRequest }>
  | Readonly<{ ok: false; reason: "not-actionable" }>;

/**
 * One reason, not four.
 *
 * "Does not exist", "already approved", "already paid" and "belongs to a
 * tenant you cannot see" collapse into `not-actionable` on purpose: told
 * apart, they answer "is this a real request id?" for anyone who can reach
 * the endpoint. The distinction the caller actually needs — did my action
 * take effect — survives intact.
 */
export type ReviewWithdrawalInput = Readonly<{ requestId: string; note: string | null }>;

function normalizeNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? "";
  // A nullable column must not carry two spellings of absent.
  return trimmed === "" ? null : trimmed;
}

export async function approveWithdrawalRequest(
  deps: ReviewWithdrawalDeps,
  input: ReviewWithdrawalInput,
): Promise<ReviewWithdrawalResult> {
  const request = await deps.withdrawalRequests.approve(
    input.requestId,
    deps.actorId,
    normalizeNote(input.note),
  );

  return request === null ? { ok: false, reason: "not-actionable" } : { ok: true, request };
}

export async function rejectWithdrawalRequest(
  deps: ReviewWithdrawalDeps,
  input: ReviewWithdrawalInput,
): Promise<ReviewWithdrawalResult> {
  // The adapter appends the reversal entry and flips the status in ONE
  // transaction. A reversal without the status change would pay the reseller
  // back again on the next rejection attempt.
  const request = await deps.withdrawalRequests.reject(
    input.requestId,
    deps.actorId,
    normalizeNote(input.note),
  );

  return request === null ? { ok: false, reason: "not-actionable" } : { ok: true, request };
}

export async function settleWithdrawalRequest(
  deps: ReviewWithdrawalDeps,
  input: ReviewWithdrawalInput,
): Promise<ReviewWithdrawalResult> {
  const request = await deps.withdrawalRequests.settle(
    input.requestId,
    normalizeNote(input.note),
  );

  return request === null ? { ok: false, reason: "not-actionable" } : { ok: true, request };
}
