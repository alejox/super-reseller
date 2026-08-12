import {
  addMoney,
  money,
  InvalidMoneyError,
  type CurrencyCode,
  type Money,
} from "@/shared/money/money";

import type { ResellerId, UserId, WalletEntryId } from "./ids";

/**
 * The wallet is an APPEND-ONLY LEDGER, and the balance is derived from it.
 *
 * There is deliberately no `balance` column anywhere. A stored balance is a
 * second source of truth that can drift from the movements that produced it,
 * and when the two disagree there is no way to tell which one lied. Summing
 * the entries cannot disagree with the entries.
 *
 * This is the same decision `plan_price` already makes: never mutate a row
 * that records something that happened. A correction is a NEW entry with the
 * opposite sign, so the mistake and its fix both stay visible.
 */

/**
 * Why a movement happened. `TOPUP` is money the operator received,
 * `ADJUSTMENT` a manual correction, `ORDER_DEBIT` a purchase.
 *
 * Kinds are additive, which is why this is a `text` CHECK and not a Postgres
 * enum — an enum value can never be removed once shipped. `ORDER_DEBIT` was
 * added by the ordering module without touching a single existing row.
 */
export type WalletEntryKind = "TOPUP" | "ADJUSTMENT" | "ORDER_DEBIT" | "WITHDRAWAL";

export type WalletEntry = Readonly<{
  id: WalletEntryId;
  resellerId: ResellerId;
  kind: WalletEntryKind;
  /**
   * SIGNED minor units: positive adds, negative removes. The sign — not the
   * `kind` — is what says which way the money went, because an ADJUSTMENT
   * legitimately goes either way.
   */
  amountMinor: number;
  currency: CurrencyCode;
  /** Operator-facing note: a receipt number, a reason for a correction. */
  memo: string | null;
  /** The user who posted it. A ledger nobody signed cannot be audited. */
  createdBy: UserId;
  createdAt: Date;
}>;

export type NewWalletEntryInput = Readonly<{
  resellerId: ResellerId;
  kind: WalletEntryKind;
  amountMinor: number;
  currency: CurrencyCode;
  memo?: string | null;
  createdBy: UserId;
  createdAt?: Date;
}>;

export function createWalletEntry(input: NewWalletEntryInput): WalletEntry {
  // Reuses shared/money's guard: rejects non-integers and malformed currency
  // codes (EB: Money Is Integer Minor Units With Currency).
  money(input.amountMinor, input.currency);

  if (input.amountMinor === 0) {
    throw new InvalidMoneyError(
      "A wallet entry must move a non-zero amount; a zero entry records nothing.",
    );
  }

  return Object.freeze({
    id: crypto.randomUUID(),
    resellerId: input.resellerId,
    kind: input.kind,
    amountMinor: input.amountMinor,
    currency: input.currency,
    memo: input.memo ?? null,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
  });
}

export function walletEntryAmount(entry: WalletEntry): Money {
  return money(entry.amountMinor, entry.currency);
}

export function isCredit(entry: WalletEntry): boolean {
  return entry.amountMinor > 0;
}

export function isDebit(entry: WalletEntry): boolean {
  return entry.amountMinor < 0;
}

/**
 * The balance: every movement summed, in `currency`.
 *
 * `addMoney` throws `CurrencyMismatchError` on a mixed-currency ledger, and
 * that throw is the feature. A number that adds COP to USD is not a balance
 * — it is a wrong answer wearing the shape of a right one, and it would be
 * displayed to a reseller as their money.
 */
export function walletBalance(
  entries: readonly WalletEntry[],
  currency: CurrencyCode,
): Money {
  return entries.reduce<Money>(
    (total, entry) => addMoney(total, walletEntryAmount(entry)),
    money(0, currency),
  );
}
