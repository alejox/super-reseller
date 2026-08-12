import { beforeEach, describe, expect, it } from "vitest";

import { mintAdminScope } from "@/modules/identity/domain/access-scope";
import { MANUAL_REVIEW_THRESHOLD_MINOR } from "../../domain/withdrawal-request";
import {
  InMemoryWalletRepository,
  InMemoryWalletStore,
} from "../../infrastructure/in-memory-wallet-repository";
import {
  InMemoryWithdrawalStore,
  InMemoryWithdrawalRepository,
  InMemoryWithdrawalRequestRepository,
} from "../../infrastructure/in-memory-withdrawal-repository";
import { requestWithdrawal } from "../reseller/request-withdrawal";
import { approveWithdrawalRequest, rejectWithdrawalRequest, settleWithdrawalRequest } from "./review-withdrawal";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const RESELLER = "11111111-1111-4111-8111-111111111111";

let walletStore: InMemoryWalletStore;
let wallet: InMemoryWalletRepository;
let withdrawalStore: InMemoryWithdrawalStore;
let withdrawals: InMemoryWithdrawalRepository;
let withdrawalRequests: InMemoryWithdrawalRequestRepository;
let methodId: string;

function reviewDeps() {
  return { withdrawalRequests, actorId: ADMIN };
}

/** Opens a request through the real use case — never by hand-building a row. */
async function openRequest(amountMinor: number) {
  const result = await requestWithdrawal(
    { withdrawalRequests, withdrawals, resellerId: RESELLER, requestedBy: RESELLER },
    { methodId, amountMinor: String(amountMinor) },
  );
  if (!result.ok) throw new Error(`fixture failed: ${result.reason}`);
  return result.request;
}

beforeEach(async () => {
  walletStore = new InMemoryWalletStore();
  wallet = new InMemoryWalletRepository(walletStore, mintAdminScope(ADMIN));
  withdrawalStore = new InMemoryWithdrawalStore();
  withdrawals = new InMemoryWithdrawalRepository(withdrawalStore);
  withdrawalRequests = new InMemoryWithdrawalRequestRepository(withdrawalStore, walletStore);

  const method = await withdrawals.addMethod({
    resellerId: RESELLER,
    type: "BANK_TRANSFER",
    details: "CBU 0170099220000067797249",
    isPrimary: true,
  });
  methodId = method.id;

  await wallet.append({
    resellerId: RESELLER,
    kind: "TOPUP",
    amountMinor: MANUAL_REVIEW_THRESHOLD_MINOR * 4,
    currency: "COP",
    createdBy: ADMIN,
  });
  await withdrawals.upsertSettings({
    resellerId: RESELLER,
    maxDailyWithdrawalMinor: MANUAL_REVIEW_THRESHOLD_MINOR * 4,
  });
});

describe("approveWithdrawalRequest", () => {
  it("approves a request under review without moving money again", async () => {
    const request = await openRequest(MANUAL_REVIEW_THRESHOLD_MINOR);
    const balanceBefore = (await wallet.balancesByReseller()).get(RESELLER);

    const result = await approveWithdrawalRequest(reviewDeps(), { requestId: request.id, note: "KYC ok" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe("APPROVED");
    expect(result.request.reviewedBy).toBe(ADMIN);
    // The debit already happened when the request opened. Approving must not
    // charge the reseller a second time.
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(balanceBefore);
  });

  it("refuses a request that was auto-approved and never went to review", async () => {
    const request = await openRequest(200_000);

    const result = await approveWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    expect(result).toEqual({ ok: false, reason: "not-actionable" });
  });

  it("refuses an id that does not exist", async () => {
    const result = await approveWithdrawalRequest(reviewDeps(), {
      requestId: "00000000-0000-4000-8000-000000000000",
      note: null,
    });

    expect(result).toEqual({ ok: false, reason: "not-actionable" });
  });
});

describe("rejectWithdrawalRequest", () => {
  it("gives the money back as a NEW entry instead of undoing the debit", async () => {
    const request = await openRequest(MANUAL_REVIEW_THRESHOLD_MINOR);
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(MANUAL_REVIEW_THRESHOLD_MINOR * 3);

    const result = await rejectWithdrawalRequest(reviewDeps(), {
      requestId: request.id,
      note: "Datos de la cuenta no coinciden",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe("REJECTED");
    expect(result.request.reversalEntryId).not.toBeNull();

    // Balance restored...
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(MANUAL_REVIEW_THRESHOLD_MINOR * 4);
    // ...and BOTH movements are still on the statement. The debit is not
    // deleted; an auditor asking why the balance moved twice can see why.
    const withdrawalEntries = (await wallet.listEntries(RESELLER)).filter(
      (entry) => entry.kind === "WITHDRAWAL",
    );
    expect(withdrawalEntries).toHaveLength(2);
    expect(withdrawalEntries.map((entry) => entry.amountMinor).sort((a, b) => a - b)).toEqual([
      -MANUAL_REVIEW_THRESHOLD_MINOR,
      MANUAL_REVIEW_THRESHOLD_MINOR,
    ]);
  });

  it("frees the rejected amount from the day's allowance", async () => {
    const request = await openRequest(MANUAL_REVIEW_THRESHOLD_MINOR);
    await rejectWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    // A rejection gave the money back, so it must not keep consuming the cap.
    const retry = await requestWithdrawal(
      { withdrawalRequests, withdrawals, resellerId: RESELLER, requestedBy: RESELLER },
      { methodId, amountMinor: String(MANUAL_REVIEW_THRESHOLD_MINOR * 4) },
    );

    expect(retry.ok).toBe(true);
  });

  it("cannot be rejected twice", async () => {
    const request = await openRequest(MANUAL_REVIEW_THRESHOLD_MINOR);
    await rejectWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    const second = await rejectWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    // Paying the reversal twice would credit the reseller money it never had.
    expect(second).toEqual({ ok: false, reason: "not-actionable" });
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(MANUAL_REVIEW_THRESHOLD_MINOR * 4);
  });
});

describe("settleWithdrawalRequest", () => {
  it("marks an approved request PAID", async () => {
    const request = await openRequest(200_000);

    const result = await settleWithdrawalRequest(reviewDeps(), {
      requestId: request.id,
      note: "Transferencia 9912",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe("PAID");
    expect(result.request.settledAt).not.toBeNull();
  });

  it("refuses to pay the same request twice", async () => {
    const request = await openRequest(200_000);
    await settleWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    const second = await settleWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    // The ledger was debited once. A second transfer is money gone with
    // nothing recording it.
    expect(second).toEqual({ ok: false, reason: "not-actionable" });
  });

  it("refuses to pay a request still under review", async () => {
    const request = await openRequest(MANUAL_REVIEW_THRESHOLD_MINOR);

    const result = await settleWithdrawalRequest(reviewDeps(), { requestId: request.id, note: null });

    expect(result).toEqual({ ok: false, reason: "not-actionable" });
  });
});
