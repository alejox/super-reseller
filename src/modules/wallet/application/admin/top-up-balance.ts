import type { ResellerId, UserId } from "../../domain/ids";
import type { WalletEntry } from "../../domain/wallet-entry";
import type { WalletRepository } from "../../domain/wallet-repository";

/**
 * ADMIN use case: credit a reseller's wallet.
 *
 * The only way money enters the platform. Payment happens off-platform — the
 * operator receives a transfer and records it here — so the `memo` is the
 * only link back to the real-world payment, and the entry is signed by the
 * admin who posted it.
 */

/** The only currency this product mints (design.md). */
export const WALLET_CURRENCY = "COP";

export type TopUpBalanceDeps = Readonly<{
  wallet: Pick<WalletRepository, "append">;
  /**
   * Injected, not imported: a reseller is IDENTITY's fact and eslint bars
   * wallet from importing identity's entity types. It matters more here than
   * in most places — see the check below.
   */
  resellerExists: (resellerId: ResellerId) => Promise<boolean>;
  /** The admin posting the entry. */
  actorId: UserId;
}>;

export type TopUpBalanceResult =
  | Readonly<{ ok: true; entry: WalletEntry }>
  | Readonly<{ ok: false; reason: "amount-invalid" | "reseller-unknown" }>;

/**
 * `Number()` is too permissive to parse a form field: it maps "", " ",
 * "0x10" and "1e3" to numbers. An empty amount arriving as 0 would be
 * rejected by the zero check, but "1e3" would silently credit 1000.
 */
function parsePositiveAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  // A top-up is a credit by definition; zero records nothing. Corrections
  // are a separate, deliberate action, never something a mistyped amount
  // can trigger.
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function topUpBalance(
  deps: TopUpBalanceDeps,
  input: Readonly<{ resellerId: string; amountMinor: string; memo: string }>,
): Promise<TopUpBalanceResult> {
  const amountMinor = parsePositiveAmount(input.amountMinor);
  if (amountMinor === null) {
    return { ok: false, reason: "amount-invalid" };
  }

  // `wallet_entry` carries NO foreign key to a reseller — the ownership axis
  // is `users.reseller_id`, an id shared by a group of rows, not a table with
  // its own primary key. Nothing at the schema level would reject a typo, so
  // this check is the only thing between a mistyped id and money credited to
  // a wallet no one can ever read.
  if (!(await deps.resellerExists(input.resellerId))) {
    return { ok: false, reason: "reseller-unknown" };
  }

  const memo = input.memo.trim();

  const entry = await deps.wallet.append({
    resellerId: input.resellerId,
    kind: "TOPUP",
    amountMinor,
    currency: WALLET_CURRENCY,
    // A nullable column must not carry two spellings of absent.
    memo: memo === "" ? null : memo,
    createdBy: deps.actorId,
  });

  return { ok: true, entry };
}
