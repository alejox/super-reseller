import { describe, expect, it } from "vitest";

import { InvalidMoneyError } from "@/shared/money/money";

import {
  approvePaymentRequest,
  createPaymentRequest,
  isPaymentMethod,
  PaymentRequestNotPendingError,
  referenceKey,
  rejectPaymentRequest,
  type NewPaymentRequestInput,
} from "./payment-request";

const RESELLER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const ENTRY = "eeeeeeee-0000-4000-8000-000000000001";

function input(overrides: Partial<NewPaymentRequestInput> = {}): NewPaymentRequestInput {
  return {
    resellerId: RESELLER,
    amountMinor: 250_000,
    currency: "COP",
    method: "BANK_TRANSFER",
    reference: "TRX-9981",
    proofUrl: "https://files.example.com/receipt.png",
    createdBy: ADMIN,
    ...overrides,
  };
}

describe("createPaymentRequest", () => {
  it("opens PENDING and moves no money", () => {
    const request = createPaymentRequest(input());

    expect(request.status).toBe("PENDING");
    // The whole point of the entity: no credit exists yet, so nothing can
    // point at one.
    expect(request.walletEntryId).toBeNull();
    expect(request.reviewedBy).toBeNull();
    expect(request.reviewedAt).toBeNull();
  });

  it("trims the reference and the proof so the stored value matches the unique index", () => {
    const request = createPaymentRequest(input({ reference: "  TRX-9981 ", proofUrl: " x.png " }));

    expect(request.reference).toBe("TRX-9981");
    expect(request.proofUrl).toBe("x.png");
  });

  it("refuses a non-positive amount", () => {
    expect(() => createPaymentRequest(input({ amountMinor: 0 }))).toThrow(InvalidMoneyError);
    expect(() => createPaymentRequest(input({ amountMinor: -1 }))).toThrow(InvalidMoneyError);
  });

  it("refuses a claim with no reference", () => {
    expect(() => createPaymentRequest(input({ reference: "   " }))).toThrow(InvalidMoneyError);
  });

  it("refuses a claim with no proof of payment", () => {
    expect(() => createPaymentRequest(input({ proofUrl: "" }))).toThrow(InvalidMoneyError);
  });
});

describe("approvePaymentRequest", () => {
  it("records the credit, the reviewer and the moment", () => {
    const at = new Date("2026-08-12T15:00:00Z");

    const approved = approvePaymentRequest(createPaymentRequest(input()), ADMIN, at, ENTRY, null);

    expect(approved.status).toBe("APPROVED");
    expect(approved.walletEntryId).toBe(ENTRY);
    expect(approved.reviewedBy).toBe(ADMIN);
    expect(approved.reviewedAt).toBe(at);
  });

  it("refuses to decide a request that was already decided", () => {
    const approved = approvePaymentRequest(
      createPaymentRequest(input()),
      ADMIN,
      new Date(),
      ENTRY,
      null,
    );

    // Approving twice would credit twice, and the ledger cannot un-append.
    expect(() => approvePaymentRequest(approved, ADMIN, new Date(), ENTRY, null)).toThrow(
      PaymentRequestNotPendingError,
    );
    expect(() => rejectPaymentRequest(approved, ADMIN, new Date(), "late")).toThrow(
      PaymentRequestNotPendingError,
    );
  });
});

describe("rejectPaymentRequest", () => {
  it("leaves the balance untouched and keeps the reason", () => {
    const rejected = rejectPaymentRequest(
      createPaymentRequest(input()),
      ADMIN,
      new Date(),
      "  El comprobante no coincide con el monto  ",
    );

    expect(rejected.status).toBe("REJECTED");
    // No entry, ever: there was no credit to reverse.
    expect(rejected.walletEntryId).toBeNull();
    expect(rejected.decisionNote).toBe("El comprobante no coincide con el monto");
    expect(rejected.reviewedBy).toBe(ADMIN);
  });

  it("refuses a rejection with no reason", () => {
    expect(() => rejectPaymentRequest(createPaymentRequest(input()), ADMIN, new Date(), "  ")).toThrow(
      InvalidMoneyError,
    );
  });
});

describe("referenceKey", () => {
  it("ignores case and surrounding space, matching the partial unique index", () => {
    expect(referenceKey("  TRX-9981 ")).toBe(referenceKey("trx-9981"));
  });
});

describe("isPaymentMethod", () => {
  it("accepts a known rail and rejects anything else", () => {
    expect(isPaymentMethod("NEQUI")).toBe(true);
    expect(isPaymentMethod("nequi")).toBe(false);
    expect(isPaymentMethod("WESTERN_UNION")).toBe(false);
  });
});
