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
import { requestWithdrawal } from "./request-withdrawal";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const RESELLER = "11111111-1111-4111-8111-111111111111";
const OTHER_RESELLER = "99999999-9999-4999-8999-999999999999";

let walletStore: InMemoryWalletStore;
let wallet: InMemoryWalletRepository;
let withdrawalStore: InMemoryWithdrawalStore;
let withdrawals: InMemoryWithdrawalRepository;
let withdrawalRequests: InMemoryWithdrawalRequestRepository;
let methodId: string;

async function fund(amountMinor: number, resellerId = RESELLER) {
  await wallet.append({
    resellerId,
    kind: "TOPUP",
    amountMinor,
    currency: "COP",
    createdBy: ADMIN,
  });
}

function deps() {
  return {
    withdrawalRequests,
    withdrawals,
    resellerId: RESELLER,
    requestedBy: RESELLER,
  };
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
});

describe("requestWithdrawal", () => {
  it("debits the ledger the moment the request is made", async () => {
    await fund(500_000);

    const result = await requestWithdrawal(deps(), { methodId, amountMinor: "200000" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The funds are reserved NOW, not at approval. This is the whole point:
    // a second request must read a balance the first one already reduced.
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(300_000);

    const entries = await wallet.listEntries(RESELLER);
    const debit = entries.find((entry) => entry.kind === "WITHDRAWAL");
    expect(debit?.amountMinor).toBe(-200_000);
    expect(result.request.walletEntryId).toBe(debit?.id);
    // The request itself stores the POSITIVE amount; the entry carries the sign.
    expect(result.request.amountMinor).toBe(200_000);
  });

  it("cannot be drained by repeating a request the balance only covers once", async () => {
    await fund(500_000);

    const first = await requestWithdrawal(deps(), { methodId, amountMinor: "500000" });
    const second = await requestWithdrawal(deps(), { methodId, amountMinor: "500000" });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "insufficient-funds", balanceMinor: 0 });
    // Never negative. A ledger that can go below zero is money the operator
    // has already paid out and can never collect.
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(0);
  });

  it("refuses more than the reseller has", async () => {
    await fund(100_000);

    const result = await requestWithdrawal(deps(), { methodId, amountMinor: "150000" });

    expect(result).toEqual({ ok: false, reason: "insufficient-funds", balanceMinor: 100_000 });
    expect(walletStore.entries).toHaveLength(1);
    expect(withdrawalStore.requests).toEqual([]);
  });

  it("sends a large request to finance instead of approving it", async () => {
    await fund(MANUAL_REVIEW_THRESHOLD_MINOR * 2);
    // The DEFAULT daily cap (500_000) sits BELOW the review threshold
    // (1_000_000), so under defaults a request is refused by the cap before
    // it can ever reach finance. Reaching review at all takes a reseller that
    // deliberately raised its own daily cap.
    await withdrawals.upsertSettings({
      resellerId: RESELLER,
      maxDailyWithdrawalMinor: MANUAL_REVIEW_THRESHOLD_MINOR * 2,
    });

    const result = await requestWithdrawal(deps(), {
      methodId,
      amountMinor: String(MANUAL_REVIEW_THRESHOLD_MINOR),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe("PENDING_REVIEW");
    // Under review or not, the money is already reserved — that is what stops
    // a reseller from queueing five reviews against one balance.
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(MANUAL_REVIEW_THRESHOLD_MINOR);
  });

  it("auto-approves a small request", async () => {
    await fund(500_000);

    const result = await requestWithdrawal(deps(), { methodId, amountMinor: "200000" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe("APPROVED");
  });

  it.each([["0"], ["-1000"], ["1000.50"], [""], ["mucho"], ["1e5"]])(
    "refuses the amount %j without touching the ledger",
    async (amountMinor) => {
      await fund(500_000);

      const result = await requestWithdrawal(deps(), { methodId, amountMinor });

      expect(result).toEqual({ ok: false, reason: "amount-invalid" });
      expect(walletStore.entries).toHaveLength(1);
    },
  );

  it("refuses a method belonging to somebody else", async () => {
    await fund(500_000);
    const theirs = await withdrawals.addMethod({
      resellerId: OTHER_RESELLER,
      type: "CRYPTO",
      details: "bc1qhijack",
      isPrimary: true,
    });

    const result = await requestWithdrawal(deps(), { methodId: theirs.id, amountMinor: "200000" });

    // Paying one reseller's balance into another reseller's account is the
    // worst outcome this module has. The method id comes from the client, so
    // ownership is checked here and not assumed.
    expect(result).toEqual({ ok: false, reason: "method-unknown" });
    expect(walletStore.entries).toHaveLength(1);
  });

  it("refuses a deactivated method", async () => {
    await fund(500_000);
    await withdrawals.deactivateMethod(RESELLER, methodId);

    const result = await requestWithdrawal(deps(), { methodId, amountMinor: "200000" });

    expect(result).toEqual({ ok: false, reason: "method-inactive" });
  });

  it("refuses an amount below the reseller's configured minimum", async () => {
    await fund(500_000);
    await withdrawals.upsertSettings({ resellerId: RESELLER, minWithdrawalMinor: 100_000 });

    const result = await requestWithdrawal(deps(), { methodId, amountMinor: "50000" });

    expect(result).toEqual({ ok: false, reason: "below-minimum", minimumMinor: 100_000 });
    expect(withdrawalStore.requests).toEqual([]);
  });

  it("applies the schema defaults when the reseller never saved settings", async () => {
    await fund(500_000);

    // 5000 minor is the `withdrawal_settings.min_withdrawal_minor` default.
    // Absent settings must mean the same limits as saved defaults, not none.
    const result = await requestWithdrawal(deps(), { methodId, amountMinor: "4999" });

    expect(result).toEqual({ ok: false, reason: "below-minimum", minimumMinor: 5000 });
  });

  it("refuses once the day's withdrawals would pass the daily cap", async () => {
    await fund(1_000_000);
    await withdrawals.upsertSettings({ resellerId: RESELLER, maxDailyWithdrawalMinor: 300_000 });

    const first = await requestWithdrawal(deps(), { methodId, amountMinor: "200000" });
    const second = await requestWithdrawal(deps(), { methodId, amountMinor: "200000" });

    expect(first.ok).toBe(true);
    expect(second).toEqual({
      ok: false,
      reason: "daily-limit-exceeded",
      withdrawnTodayMinor: 200_000,
      limitMinor: 300_000,
    });
    // The refused request left nothing behind: no debit, no row.
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(800_000);
    expect(withdrawalStore.requests).toHaveLength(1);
  });
});
