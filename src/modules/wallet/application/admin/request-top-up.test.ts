import { beforeEach, describe, expect, it } from "vitest";

import { mintAdminScope } from "@/modules/identity/domain/access-scope";

import { createTopUpLimits } from "../../domain/top-up-limits";
import {
  InMemoryPaymentRequestRepository,
  InMemoryPaymentRequestStore,
} from "../../infrastructure/in-memory-payment-request-repository";
import { InMemoryTopUpSettingsRepository } from "../../infrastructure/in-memory-top-up-settings-repository";
import { InMemoryWalletStore } from "../../infrastructure/in-memory-wallet-repository";
import { requestTopUp, type RequestTopUpDeps, type RequestTopUpInput } from "./request-top-up";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const RESELLER = "11111111-1111-4111-8111-111111111111";

let wallet: InMemoryWalletStore;
let requests: InMemoryPaymentRequestStore;
let repository: InMemoryPaymentRequestRepository;
let settings: InMemoryTopUpSettingsRepository;

function deps(overrides: Partial<RequestTopUpDeps> = {}): RequestTopUpDeps {
  return {
    paymentRequests: repository,
    settings,
    resellerExists: async (id) => id === RESELLER,
    actorId: ADMIN,
    ...overrides,
  };
}

function input(overrides: Partial<RequestTopUpInput> = {}): RequestTopUpInput {
  return {
    resellerId: RESELLER,
    amountMinor: "250000",
    method: "BANK_TRANSFER",
    reference: "TRX-9981",
    proofUrl: "https://files.example.com/receipt.png",
    ...overrides,
  };
}

beforeEach(() => {
  wallet = new InMemoryWalletStore();
  requests = new InMemoryPaymentRequestStore();
  repository = new InMemoryPaymentRequestRepository(requests, wallet, mintAdminScope(ADMIN));
  settings = new InMemoryTopUpSettingsRepository();
});

describe("requestTopUp", () => {
  it("files a PENDING claim and does NOT move the balance", async () => {
    const result = await requestTopUp(deps(), input());

    expect(result.ok).toBe(true);
    expect(requests.requests).toHaveLength(1);
    expect(requests.requests[0]?.status).toBe("PENDING");
    // The regression this whole feature exists to prevent: the previous
    // `topUpBalance` appended a TOPUP entry right here.
    expect(wallet.entries).toEqual([]);
  });

  it("mints COP, never a currency the caller chose", async () => {
    await requestTopUp(deps(), input());

    expect(requests.requests[0]?.currency).toBe("COP");
  });

  it("refuses an amount that is not a plain positive integer", async () => {
    for (const amountMinor of ["", " ", "0", "-5", "1e3", "0x10", "12.5", "abc"]) {
      const result = await requestTopUp(deps(), input({ amountMinor }));

      expect(result).toEqual({ ok: false, reason: "amount-invalid" });
    }
    expect(requests.requests).toEqual([]);
  });

  it("enforces the configured limits on the SERVER, not just in the form", async () => {
    await settings.save(createTopUpLimits({ minAmountMinor: 50_000, maxAmountMinor: 100_000 }), ADMIN);

    expect(await requestTopUp(deps(), input({ amountMinor: "49999" }))).toEqual({
      ok: false,
      reason: "below-minimum",
      limitMinor: 50_000,
    });
    expect(await requestTopUp(deps(), input({ amountMinor: "100001" }))).toEqual({
      ok: false,
      reason: "above-maximum",
      limitMinor: 100_000,
    });
    expect(requests.requests).toEqual([]);
  });

  it("accepts the exact bounds", async () => {
    await settings.save(createTopUpLimits({ minAmountMinor: 50_000, maxAmountMinor: 100_000 }), ADMIN);

    expect((await requestTopUp(deps(), input({ amountMinor: "50000" }))).ok).toBe(true);
    expect((await requestTopUp(deps(), input({ amountMinor: "100000", reference: "TRX-2" }))).ok).toBe(
      true,
    );
  });

  it("refuses a claim with no proof of payment", async () => {
    const result = await requestTopUp(deps(), input({ proofUrl: "   " }));

    expect(result).toEqual({ ok: false, reason: "proof-required" });
  });

  it("refuses a claim with no payment reference", async () => {
    const result = await requestTopUp(deps(), input({ reference: "" }));

    expect(result).toEqual({ ok: false, reason: "reference-required" });
  });

  it("refuses a payment rail it does not know", async () => {
    const result = await requestTopUp(deps(), input({ method: "WESTERN_UNION" }));

    expect(result).toEqual({ ok: false, reason: "method-invalid" });
  });

  it("refuses an unknown reseller", async () => {
    // `payment_request` has no foreign key to a reseller, so this check is the
    // only thing between a mistyped id and a claim nobody can ever see.
    const result = await requestTopUp(deps(), input({ resellerId: "not-a-reseller" }));

    expect(result).toEqual({ ok: false, reason: "reseller-unknown" });
  });

  it("refuses a reference already used by an APPROVED claim", async () => {
    await requestTopUp(deps(), input());
    await repository.approve(requests.requests[0].id, ADMIN, null);

    const result = await requestTopUp(deps(), input());

    expect(result).toEqual({ ok: false, reason: "reference-taken" });
  });

  it("allows reusing the reference of a REJECTED claim", async () => {
    await requestTopUp(deps(), input());
    await repository.reject(requests.requests[0].id, ADMIN, "Comprobante ilegible");

    // The operator has to be able to correct a mistake and resubmit; blanket
    // uniqueness would make a rejection permanent.
    const result = await requestTopUp(deps(), input());

    expect(result.ok).toBe(true);
  });
});
