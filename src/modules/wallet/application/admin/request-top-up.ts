import type { ResellerId, UserId } from "../../domain/ids";
import { isPaymentMethod, type PaymentRequest } from "../../domain/payment-request";
import type { PaymentRequestRepository } from "../../domain/payment-request-repository";
import { checkWithinLimits } from "../../domain/top-up-limits";
import type { TopUpSettingsRepository } from "../../domain/top-up-settings-repository";
import { WALLET_CURRENCY } from "../../domain/wallet-entry";

/**
 * ADMIN use case: record that a reseller says they paid.
 *
 * This REPLACES `topUpBalance`, which credited the ledger the instant the
 * button was clicked. Nothing here touches a balance. It files a claim, and a
 * human decides — see `review-payment-request.ts`.
 *
 * The limits are read from the platform settings on EVERY call, deliberately.
 * The old screen validated a range in the browser only, where `min`/`max`
 * attributes are a suggestion to anyone with dev tools open; a limit that only
 * exists in the client is not a limit (backlog A9).
 */

export type RequestTopUpDeps = Readonly<{
  paymentRequests: Pick<PaymentRequestRepository, "open">;
  settings: Pick<TopUpSettingsRepository, "read">;
  /**
   * Injected, not imported: a reseller is IDENTITY's fact and eslint bars
   * wallet from importing identity's entity types. It matters more here than
   * in most places — `payment_request` carries no foreign key to a reseller,
   * so nothing at the schema level would reject a typo.
   */
  resellerExists: (resellerId: ResellerId) => Promise<boolean>;
  /** The admin filing the claim. */
  actorId: UserId;
}>;

export type RequestTopUpResult =
  | Readonly<{ ok: true; request: PaymentRequest }>
  | Readonly<{
      ok: false;
      reason:
        | "amount-invalid"
        | "reseller-unknown"
        | "method-invalid"
        | "reference-required"
        | "proof-required"
        | "reference-taken";
    }>
  | Readonly<{ ok: false; reason: "below-minimum" | "above-maximum"; limitMinor: number }>;

export type RequestTopUpInput = Readonly<{
  resellerId: string;
  amountMinor: string;
  method: string;
  reference: string;
  proofUrl: string;
}>;

/**
 * `Number()` is too permissive to parse a form field: it maps "", " ",
 * "0x10" and "1e3" to numbers. An empty amount arriving as 0 would be caught
 * by the positivity check, but "1e3" would silently claim 1000.
 */
function parsePositiveAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function requestTopUp(
  deps: RequestTopUpDeps,
  input: RequestTopUpInput,
): Promise<RequestTopUpResult> {
  const amountMinor = parsePositiveAmount(input.amountMinor);
  if (amountMinor === null) {
    return { ok: false, reason: "amount-invalid" };
  }

  if (!isPaymentMethod(input.method)) {
    return { ok: false, reason: "method-invalid" };
  }

  const reference = input.reference.trim();
  if (reference === "") {
    return { ok: false, reason: "reference-required" };
  }

  const proofUrl = input.proofUrl.trim();
  if (proofUrl === "") {
    // Backlog A3. Refused in the use case and not only in the form, for the
    // same reason the limits are: `required` on an input is a suggestion.
    return { ok: false, reason: "proof-required" };
  }

  const limits = await deps.settings.read();
  const within = checkWithinLimits(limits, amountMinor);
  if (!within.ok) {
    return { ok: false, reason: within.reason, limitMinor: within.limitMinor };
  }

  if (!(await deps.resellerExists(input.resellerId))) {
    return { ok: false, reason: "reseller-unknown" };
  }

  const outcome = await deps.paymentRequests.open({
    resellerId: input.resellerId,
    amountMinor,
    currency: WALLET_CURRENCY,
    method: input.method,
    reference,
    proofUrl,
    createdBy: deps.actorId,
  });

  if (!outcome.ok) {
    return { ok: false, reason: "reference-taken" };
  }

  return { ok: true, request: outcome.request };
}
