import { beforeEach, describe, expect, it } from "vitest";

import { mintAdminScope } from "@/modules/identity/domain/access-scope";

import { walletBalance } from "../../domain/wallet-entry";
import {
  InMemoryPaymentRequestRepository,
  InMemoryPaymentRequestStore,
} from "../../infrastructure/in-memory-payment-request-repository";
import { InMemoryTopUpSettingsRepository } from "../../infrastructure/in-memory-top-up-settings-repository";
import { InMemoryWalletStore } from "../../infrastructure/in-memory-wallet-repository";
import { requestTopUp } from "./request-top-up";
import { approvePayment, rejectPayment } from "./review-payment-request";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER_ADMIN = "aaaaaaaa-0000-4000-8000-000000000002";
const RESELLER = "11111111-1111-4111-8111-111111111111";

let wallet: InMemoryWalletStore;
let requests: InMemoryPaymentRequestStore;
let repository: InMemoryPaymentRequestRepository;

function reviewDeps(actorId = ADMIN) {
  return { paymentRequests: repository, actorId };
}

async function fileClaim(reference = "TRX-9981", amountMinor = "250000") {
  const result = await requestTopUp(
    {
      paymentRequests: repository,
      settings: new InMemoryTopUpSettingsRepository(),
      resellerExists: async () => true,
      actorId: ADMIN,
    },
    {
      resellerId: RESELLER,
      amountMinor,
      method: "NEQUI",
      reference,
      proofUrl: "https://files.example.com/receipt.png",
    },
  );

  if (!result.ok) throw new Error(`fixture failed: ${result.reason}`);
  return result.request;
}

function balance(): number {
  return walletBalance(wallet.entries, "COP").amountMinor;
}

beforeEach(() => {
  wallet = new InMemoryWalletStore();
  requests = new InMemoryPaymentRequestStore();
  repository = new InMemoryPaymentRequestRepository(requests, wallet, mintAdminScope(ADMIN));
});

describe("approvePayment", () => {
  it("credits the balance ONLY on approval", async () => {
    const claim = await fileClaim();
    expect(balance()).toBe(0);

    const result = await approvePayment(reviewDeps(), { requestId: claim.id, note: null });

    expect(result.ok).toBe(true);
    expect(balance()).toBe(250_000);
  });

  it("appends a TOPUP entry that names the payment it came from", async () => {
    const claim = await fileClaim("TRX-4242");

    const result = await approvePayment(reviewDeps(), { requestId: claim.id, note: null });

    if (!result.ok) throw new Error("expected approval");
    expect(result.entry.kind).toBe("TOPUP");
    expect(result.entry.amountMinor).toBe(250_000);
    // The link back to the real-world transfer, for whoever audits the
    // statement a year from now.
    expect(result.entry.memo).toBe("Pago TRX-4242");
  });

  it("points the request at the entry it produced", async () => {
    const claim = await fileClaim();

    const result = await approvePayment(reviewDeps(), { requestId: claim.id, note: null });

    if (!result.ok) throw new Error("expected approval");
    // "Was this approved" and "did the balance move" are one fact stored once.
    expect(result.request.walletEntryId).toBe(result.entry.id);
  });

  it("records who approved it and when", async () => {
    const claim = await fileClaim();

    const result = await approvePayment(reviewDeps(OTHER_ADMIN), { requestId: claim.id, note: "ok" });

    if (!result.ok) throw new Error("expected approval");
    expect(result.request.reviewedBy).toBe(OTHER_ADMIN);
    expect(result.request.reviewedAt).toBeInstanceOf(Date);
    expect(result.request.decisionNote).toBe("ok");
  });

  it("credits once, even when approved twice", async () => {
    const claim = await fileClaim();
    await approvePayment(reviewDeps(), { requestId: claim.id, note: null });

    const second = await approvePayment(reviewDeps(), { requestId: claim.id, note: null });

    expect(second).toEqual({ ok: false, reason: "not-actionable" });
    expect(balance()).toBe(250_000);
    expect(wallet.entries).toHaveLength(1);
  });

  it("refuses to approve a second claim carrying an already-approved reference", async () => {
    const first = await fileClaim("TRX-DUP");
    // Two pending claims may share a reference; only one may ever be approved.
    requests.requests.push({ ...first, id: crypto.randomUUID() });
    await approvePayment(reviewDeps(), { requestId: first.id, note: null });

    const twin = requests.requests.find((request) => request.status === "PENDING");
    const result = await approvePayment(reviewDeps(), { requestId: twin!.id, note: null });

    expect(result).toEqual({ ok: false, reason: "reference-taken" });
    expect(balance()).toBe(250_000);
  });

  it("reports an unknown id as not-actionable", async () => {
    const result = await approvePayment(reviewDeps(), {
      requestId: crypto.randomUUID(),
      note: null,
    });

    expect(result).toEqual({ ok: false, reason: "not-actionable" });
  });
});

describe("rejectPayment", () => {
  it("leaves the balance untouched and keeps the reason", async () => {
    const claim = await fileClaim();

    const result = await rejectPayment(reviewDeps(), {
      requestId: claim.id,
      reason: "El comprobante no coincide con el monto",
    });

    if (!result.ok) throw new Error("expected rejection");
    expect(result.request.status).toBe("REJECTED");
    expect(result.request.decisionNote).toBe("El comprobante no coincide con el monto");
    // No credit, and no compensating debit either: nothing ever moved.
    expect(wallet.entries).toEqual([]);
    expect(balance()).toBe(0);
  });

  it("records who rejected it", async () => {
    const claim = await fileClaim();

    const result = await rejectPayment(reviewDeps(OTHER_ADMIN), {
      requestId: claim.id,
      reason: "Pago no recibido",
    });

    if (!result.ok) throw new Error("expected rejection");
    expect(result.request.reviewedBy).toBe(OTHER_ADMIN);
    expect(result.request.reviewedAt).toBeInstanceOf(Date);
  });

  it("refuses a rejection with no reason, with a message rather than a 500", async () => {
    const claim = await fileClaim();

    const result = await rejectPayment(reviewDeps(), { requestId: claim.id, reason: "   " });

    expect(result).toEqual({ ok: false, reason: "reason-required" });
    expect(requests.requests[0]?.status).toBe("PENDING");
  });

  it("cannot reject what was already approved", async () => {
    const claim = await fileClaim();
    await approvePayment(reviewDeps(), { requestId: claim.id, note: null });

    const result = await rejectPayment(reviewDeps(), { requestId: claim.id, reason: "cambié de idea" });

    expect(result).toEqual({ ok: false, reason: "not-actionable" });
    // The credit stands. A mistaken approval is corrected with a new
    // ADJUSTMENT entry, never by rewriting history.
    expect(balance()).toBe(250_000);
  });
});
