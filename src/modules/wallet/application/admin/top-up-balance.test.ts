import { beforeEach, describe, expect, it, vi } from "vitest";

import { mintAdminScope } from "@/modules/identity/domain/access-scope";
import {
  InMemoryWalletRepository,
  InMemoryWalletStore,
} from "../../infrastructure/in-memory-wallet-repository";
import { topUpBalance } from "./top-up-balance";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const RESELLER = "11111111-1111-4111-8111-111111111111";

let store: InMemoryWalletStore;
let wallet: InMemoryWalletRepository;

function deps(overrides: Partial<Parameters<typeof topUpBalance>[0]> = {}) {
  return {
    wallet,
    resellerExists: async () => true,
    actorId: ADMIN,
    ...overrides,
  };
}

beforeEach(() => {
  store = new InMemoryWalletStore();
  wallet = new InMemoryWalletRepository(store, mintAdminScope(ADMIN));
});

describe("topUpBalance", () => {
  it("credits the reseller and records who did it", async () => {
    const result = await topUpBalance(deps(), {
      resellerId: RESELLER,
      amountMinor: "250000",
      memo: "Transferencia 4821",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.amountMinor).toBe(250_000);
    expect(result.entry.kind).toBe("TOPUP");
    expect(result.entry.memo).toBe("Transferencia 4821");
    // A ledger nobody signed cannot be audited.
    expect(result.entry.createdBy).toBe(ADMIN);
    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(250_000);
  });

  it("stores an omitted memo as null rather than an empty string", async () => {
    const result = await topUpBalance(deps(), {
      resellerId: RESELLER,
      amountMinor: "250000",
      memo: "   ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.memo).toBeNull();
  });

  it("accumulates across top-ups", async () => {
    await topUpBalance(deps(), { resellerId: RESELLER, amountMinor: "250000", memo: "" });
    await topUpBalance(deps(), { resellerId: RESELLER, amountMinor: "50000", memo: "" });

    expect((await wallet.balancesByReseller()).get(RESELLER)).toBe(300_000);
    expect(await wallet.listEntries(RESELLER)).toHaveLength(2);
  });

  it.each([
    ["0", "amount-invalid"],
    ["-1000", "amount-invalid"],
    ["1000.50", "amount-invalid"],
    ["", "amount-invalid"],
    ["mucho", "amount-invalid"],
    ["1e5", "amount-invalid"],
  ])("refuses the amount %j with reason %s", async (amountMinor, reason) => {
    const result = await topUpBalance(deps(), { resellerId: RESELLER, amountMinor, memo: "" });

    expect(result).toEqual({ ok: false, reason });
    expect(store.entries).toEqual([]);
  });

  it("refuses a top-up for a reseller that does not exist", async () => {
    const resellerExists = vi.fn().mockResolvedValue(false);

    const result = await topUpBalance(deps({ resellerExists }), {
      resellerId: "unknown",
      amountMinor: "250000",
      memo: "",
    });

    // `wallet_entry` deliberately carries NO foreign key to a reseller: the
    // ownership axis is an id, not a table, so nothing at the schema level
    // would catch a typo. This check is the only thing standing between a
    // mistyped id and money credited to a wallet nobody can ever read.
    expect(result).toEqual({ ok: false, reason: "reseller-unknown" });
    expect(store.entries).toEqual([]);
  });

  it("never writes a negative movement, whatever the caller passes", async () => {
    // A top-up is a credit by definition. Corrections are a separate,
    // deliberate action — not something a mistyped amount can trigger.
    await topUpBalance(deps(), { resellerId: RESELLER, amountMinor: "-999", memo: "" });

    expect(store.entries).toEqual([]);
  });
});
