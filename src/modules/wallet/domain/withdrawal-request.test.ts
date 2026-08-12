import { describe, expect, it } from "vitest";

import {
  MANUAL_REVIEW_THRESHOLD_MINOR,
  WithdrawalNotApprovedError,
  WithdrawalNotUnderReviewError,
  approveWithdrawal,
  createWithdrawalRequest,
  initialStatusFor,
  rejectWithdrawal,
  requiresManualReview,
  settleWithdrawal,
} from "./withdrawal-request";

const RESELLER = "11111111-1111-4111-8111-111111111111";
const METHOD = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";
const REQUESTER = "44444444-4444-4444-8444-444444444444";
const REVIEWER = "55555555-5555-4555-8555-555555555555";

function newRequest(amountMinor: number) {
  return createWithdrawalRequest({
    resellerId: RESELLER,
    methodId: METHOD,
    amountMinor,
    currency: "COP",
    walletEntryId: ENTRY,
    requestedBy: REQUESTER,
  });
}

describe("requiresManualReview", () => {
  it("sends an amount at or above the threshold to finance", () => {
    expect(requiresManualReview(MANUAL_REVIEW_THRESHOLD_MINOR)).toBe(true);
    expect(requiresManualReview(MANUAL_REVIEW_THRESHOLD_MINOR + 1)).toBe(true);
  });

  it("lets an amount below the threshold through", () => {
    expect(requiresManualReview(MANUAL_REVIEW_THRESHOLD_MINOR - 1)).toBe(false);
    expect(requiresManualReview(1)).toBe(false);
  });

  it("decides the status a new request opens in", () => {
    expect(initialStatusFor(MANUAL_REVIEW_THRESHOLD_MINOR)).toBe("PENDING_REVIEW");
    expect(initialStatusFor(1)).toBe("APPROVED");
  });
});

describe("createWithdrawalRequest", () => {
  it("stores the amount POSITIVE — the ledger entry carries the sign", () => {
    // The request records "how much was asked for". The money leaving is the
    // wallet entry, and that one is negative. Two signs for one fact is how a
    // report ends up double-counting a withdrawal.
    const request = newRequest(250_000);

    expect(request.amountMinor).toBe(250_000);
    expect(request.walletEntryId).toBe(ENTRY);
    expect(request.reversalEntryId).toBeNull();
  });

  it("refuses a non-positive amount", () => {
    expect(() => newRequest(0)).toThrow();
    expect(() => newRequest(-250_000)).toThrow();
  });

  it("opens a large request under review and a small one already approved", () => {
    expect(newRequest(MANUAL_REVIEW_THRESHOLD_MINOR).status).toBe("PENDING_REVIEW");
    expect(newRequest(250_000).status).toBe("APPROVED");
  });

  it("leaves the review fields empty until someone reviews it", () => {
    const request = newRequest(MANUAL_REVIEW_THRESHOLD_MINOR);

    expect(request.reviewedBy).toBeNull();
    expect(request.reviewedAt).toBeNull();
    expect(request.settledAt).toBeNull();
  });
});

describe("approveWithdrawal", () => {
  it("moves a reviewed request to APPROVED and signs it", () => {
    const at = new Date("2026-08-12T10:00:00Z");
    const approved = approveWithdrawal(
      newRequest(MANUAL_REVIEW_THRESHOLD_MINOR),
      REVIEWER,
      at,
      "KYC ok",
    );

    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedBy).toBe(REVIEWER);
    expect(approved.reviewedAt).toEqual(at);
    expect(approved.note).toBe("KYC ok");
  });

  it("refuses to re-approve something that never went to review", () => {
    // An auto-approved request has already had its funds debited and is
    // waiting to be paid. Running it through approval again would let a
    // second reviewer sign a decision nobody asked them to make.
    expect(() => approveWithdrawal(newRequest(250_000), REVIEWER, new Date(), null)).toThrow(
      WithdrawalNotUnderReviewError,
    );
  });
});

describe("rejectWithdrawal", () => {
  it("moves a reviewed request to REJECTED and records the reversal entry", () => {
    const at = new Date("2026-08-12T10:00:00Z");
    const rejected = rejectWithdrawal(
      newRequest(MANUAL_REVIEW_THRESHOLD_MINOR),
      REVIEWER,
      at,
      "Datos de la cuenta no coinciden",
      "66666666-6666-4666-8666-666666666666",
    );

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.reviewedBy).toBe(REVIEWER);
    // The debit is NOT undone — the ledger is append-only. The money comes
    // back as a NEW entry with the opposite sign, so the request and its
    // reversal both stay visible.
    expect(rejected.walletEntryId).toBe(ENTRY);
    expect(rejected.reversalEntryId).toBe("66666666-6666-4666-8666-666666666666");
  });

  it("refuses to reject a request that is not under review", () => {
    expect(() =>
      rejectWithdrawal(newRequest(250_000), REVIEWER, new Date(), null, ENTRY),
    ).toThrow(WithdrawalNotUnderReviewError);
  });
});

describe("settleWithdrawal", () => {
  it("marks an approved request PAID once the transfer actually left", () => {
    const at = new Date("2026-08-12T12:00:00Z");
    const paid = settleWithdrawal(newRequest(250_000), at, "Transferencia 9912");

    expect(paid.status).toBe("PAID");
    expect(paid.settledAt).toEqual(at);
    expect(paid.note).toBe("Transferencia 9912");
  });

  it("refuses to pay a request still under review", () => {
    expect(() =>
      settleWithdrawal(newRequest(MANUAL_REVIEW_THRESHOLD_MINOR), new Date(), null),
    ).toThrow(WithdrawalNotApprovedError);
  });

  it("refuses to pay the same request twice", () => {
    // Paying twice is the single most expensive bug this module can have:
    // the ledger was debited once, so the second transfer is money gone with
    // nothing recording it.
    const paid = settleWithdrawal(newRequest(250_000), new Date(), null);

    expect(() => settleWithdrawal(paid, new Date(), null)).toThrow(WithdrawalNotApprovedError);
  });
});
