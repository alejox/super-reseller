import { describe, expect, it } from "vitest";

import { CurrencyMismatchError, InvalidMoneyError, money } from "@/shared/money/money";
import {
  createWalletEntry,
  isCredit,
  isDebit,
  walletBalance,
  walletEntryAmount,
  type WalletEntry,
} from "./wallet-entry";

const RESELLER = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";

function entry(amountMinor: number, currency = "COP"): WalletEntry {
  return createWalletEntry({
    resellerId: RESELLER,
    kind: amountMinor >= 0 ? "TOPUP" : "ADJUSTMENT",
    amountMinor,
    currency,
    memo: null,
    createdBy: ACTOR,
  });
}

describe("createWalletEntry", () => {
  it("builds a frozen entry with its own id and timestamp", () => {
    const created = entry(250_000);

    expect(created.resellerId).toBe(RESELLER);
    expect(created.amountMinor).toBe(250_000);
    expect(created.currency).toBe("COP");
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(Object.isFrozen(created)).toBe(true);
  });

  it("accepts a negative amount, because a correction is a compensating entry", () => {
    // Entries are append-only: there is no update and no delete, so the only
    // way to undo a mistake is to post its opposite. Refusing negatives here
    // would leave a wrong balance permanently uncorrectable.
    const created = entry(-50_000);

    expect(created.amountMinor).toBe(-50_000);
    expect(isDebit(created)).toBe(true);
    expect(isCredit(created)).toBe(false);
  });

  it("refuses a zero amount", () => {
    // A zero-value movement records nothing and only adds noise to a
    // statement the reseller has to read.
    expect(() => entry(0)).toThrow(InvalidMoneyError);
  });

  it("refuses a non-integer amount", () => {
    expect(() => entry(1.5)).toThrow(InvalidMoneyError);
  });

  it("refuses a malformed currency", () => {
    expect(() => entry(1000, "pesos")).toThrow(InvalidMoneyError);
  });

  it("exposes its amount as Money", () => {
    expect(walletEntryAmount(entry(250_000))).toEqual({ amountMinor: 250_000, currency: "COP" });
  });
});

describe("walletBalance", () => {
  it("is zero for a wallet with no movements", () => {
    // A reseller who has never been credited has no rows at all, and that is
    // a zero balance rather than a missing one — there is no wallet record to
    // create, so there is no state to get out of sync.
    expect(walletBalance([], "COP")).toEqual({ amountMinor: 0, currency: "COP" });
  });

  it("sums credits and debits", () => {
    const balance = walletBalance([entry(250_000), entry(-15_000), entry(30_000)], "COP");

    expect(balance).toEqual({ amountMinor: 265_000, currency: "COP" });
  });

  it("throws rather than sum a wallet holding two currencies", () => {
    // `addMoney` refuses a cross-currency add, and that refusal is the point:
    // a number that mixes COP and USD is not a balance, it is a wrong answer
    // presented as a right one.
    expect(() => walletBalance([entry(1000, "COP"), entry(1000, "USD")], "COP")).toThrow(
      CurrencyMismatchError,
    );
  });

  it("throws when the entries do not match the requested currency", () => {
    expect(() => walletBalance([entry(1000, "USD")], "COP")).toThrow(CurrencyMismatchError);
  });

  it("never mutates the entries it sums", () => {
    const entries = [entry(1000), entry(2000)];
    const before = entries.map((e) => e.amountMinor);

    walletBalance(entries, "COP");

    expect(entries.map((e) => e.amountMinor)).toEqual(before);
  });
});

describe("isCredit / isDebit", () => {
  it("classifies by sign, not by kind", () => {
    // `kind` records WHY a movement happened; the sign records which way the
    // money went. An ADJUSTMENT can go either way, so reading the sign is the
    // only correct way to answer "did this add or remove money".
    const negativeTopup = createWalletEntry({
      resellerId: RESELLER,
      kind: "TOPUP",
      amountMinor: -1,
      currency: "COP",
      memo: null,
      createdBy: ACTOR,
    });

    expect(isDebit(negativeTopup)).toBe(true);
    expect(isCredit(negativeTopup)).toBe(false);
  });
});

describe("money interop", () => {
  it("produces a Money value the shared module accepts", () => {
    expect(walletEntryAmount(entry(7))).toEqual(money(7, "COP"));
  });
});
