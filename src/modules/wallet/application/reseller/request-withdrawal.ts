import type { ResellerId, UserId } from "../../domain/ids";
import { DEFAULT_WITHDRAWAL_SETTINGS, type WithdrawalRepository } from "../../domain/withdrawal";
import type { WithdrawalRequest } from "../../domain/withdrawal-request";
import type { WithdrawalRequestRepository } from "../../domain/withdrawal-request-repository";
import { WALLET_CURRENCY } from "../admin/top-up-balance";

/**
 * RESELLER use case: take money out.
 *
 * The mirror of `topUpBalance`, and the only way money leaves the platform.
 * The order of the checks is deliberate — everything that can be decided
 * without touching the ledger is decided first, so a malformed amount or a
 * stolen method id never reaches the transaction that moves money.
 */

export type RequestWithdrawalDeps = Readonly<{
  withdrawalRequests: Pick<WithdrawalRequestRepository, "openRequest">;
  withdrawals: Pick<WithdrawalRepository, "getMethods" | "getSettings">;
  /** From the caller's `AccessScope`, never from the form. */
  resellerId: ResellerId;
  requestedBy: UserId;
}>;

export type RequestWithdrawalResult =
  | Readonly<{ ok: true; request: WithdrawalRequest }>
  | Readonly<{ ok: false; reason: "amount-invalid" | "method-unknown" | "method-inactive" }>
  | Readonly<{ ok: false; reason: "below-minimum"; minimumMinor: number }>
  | Readonly<{ ok: false; reason: "insufficient-funds"; balanceMinor: number }>
  | Readonly<{
      ok: false;
      reason: "daily-limit-exceeded";
      withdrawnTodayMinor: number;
      limitMinor: number;
    }>;

/**
 * Same guard as `topUpBalance`'s: `Number()` maps "", " ", "0x10" and "1e3"
 * to numbers, and "1e5" silently becoming 100000 is a withdrawal nobody
 * typed.
 */
function parsePositiveAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function requestWithdrawal(
  deps: RequestWithdrawalDeps,
  input: Readonly<{ methodId: string; amountMinor: string }>,
): Promise<RequestWithdrawalResult> {
  const amountMinor = parsePositiveAmount(input.amountMinor);
  if (amountMinor === null) {
    return { ok: false, reason: "amount-invalid" };
  }

  // `getMethods` is scoped to the caller's own reseller id, so a method that
  // belongs to somebody else is simply absent here. That is the check: the
  // method id arrives from the client, and paying one reseller's balance into
  // another reseller's bank account is the worst thing this module can do.
  const methods = await deps.withdrawals.getMethods(deps.resellerId);
  const method = methods.find((candidate) => candidate.id === input.methodId);
  if (method === undefined) {
    return { ok: false, reason: "method-unknown" };
  }
  if (!method.isActive) {
    return { ok: false, reason: "method-inactive" };
  }

  // A reseller that never opened the settings screen gets the SAME limits as
  // one that opened it and saved nothing. Absent settings meaning "no limits"
  // would make the safest reseller the least protected one.
  const saved = await deps.withdrawals.getSettings(deps.resellerId);
  const settings = saved ?? DEFAULT_WITHDRAWAL_SETTINGS;

  if (amountMinor < settings.minWithdrawalMinor) {
    return { ok: false, reason: "below-minimum", minimumMinor: settings.minWithdrawalMinor };
  }

  // Balance, daily cap, debit and request row are ONE transaction inside the
  // adapter. Checking the balance out here would read a number that another
  // request can invalidate before the debit lands.
  const outcome = await deps.withdrawalRequests.openRequest({
    resellerId: deps.resellerId,
    methodId: method.id,
    amountMinor,
    currency: WALLET_CURRENCY,
    requestedBy: deps.requestedBy,
    maxDailyWithdrawalMinor: settings.maxDailyWithdrawalMinor,
  });

  return outcome;
}
