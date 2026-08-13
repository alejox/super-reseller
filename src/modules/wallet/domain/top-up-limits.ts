import type { CurrencyCode } from "@/shared/money/money";
import { InvalidMoneyError, money } from "@/shared/money/money";

import type { UserId } from "./ids";

/**
 * The min/max a single top-up may claim.
 *
 * These are PLATFORM settings, configured by the ADMIN — unlike
 * `withdrawal_settings`, which is configured by the reseller it governs. That
 * distinction is not cosmetic: a limit the controlled party can raise on
 * itself is not a control, which is why this one lives in its own table with
 * its own screen instead of being folded into the per-reseller settings.
 *
 * Amounts are in COP, whose smallest practical unit is the PESO, not a cent —
 * `formatMoney` resolves COP to 0 fraction digits. So the defaults below are
 * ten thousand and five million PESOS. They deliberately do NOT match the
 * "$10.00 / $1000.00" that `app/admin/settings/page.tsx` used to show: that
 * screen was a static mockup written against a US-dollar figure this ledger
 * has never held.
 */

export const TOP_UP_LIMITS_CURRENCY = "COP";

export type TopUpLimits = Readonly<{
  minAmountMinor: number;
  maxAmountMinor: number;
  currency: CurrencyCode;
  /** Who last changed them. NULL while the defaults have never been edited. */
  updatedBy: UserId | null;
  updatedAt: Date | null;
}>;

export const DEFAULT_TOP_UP_LIMITS: TopUpLimits = Object.freeze({
  minAmountMinor: 10_000,
  maxAmountMinor: 5_000_000,
  currency: TOP_UP_LIMITS_CURRENCY,
  updatedBy: null,
  updatedAt: null,
});

export type TopUpLimitsInput = Readonly<{
  minAmountMinor: number;
  maxAmountMinor: number;
  currency?: CurrencyCode;
}>;

/**
 * Validates a limits pair before it can be stored.
 *
 * `min > max` is refused rather than silently swapped: a range nobody can
 * satisfy blocks every top-up on the platform, and an operator who typed the
 * fields in the wrong order needs to be told, not quietly corrected into a
 * range they did not ask for.
 */
export function createTopUpLimits(
  input: TopUpLimitsInput,
  updatedBy: UserId | null = null,
  updatedAt: Date | null = null,
): TopUpLimits {
  const currency = input.currency ?? TOP_UP_LIMITS_CURRENCY;

  // Reuses shared/money's guard: rejects non-integers and malformed codes.
  money(input.minAmountMinor, currency);
  money(input.maxAmountMinor, currency);

  if (input.minAmountMinor <= 0) {
    throw new InvalidMoneyError("The minimum top-up must be a positive amount.");
  }

  if (input.maxAmountMinor < input.minAmountMinor) {
    throw new InvalidMoneyError(
      "The maximum top-up cannot be below the minimum; no amount would be accepted.",
    );
  }

  return Object.freeze({
    minAmountMinor: input.minAmountMinor,
    maxAmountMinor: input.maxAmountMinor,
    currency,
    updatedBy,
    updatedAt,
  });
}

export type LimitCheck =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "below-minimum" | "above-maximum"; limitMinor: number }>;

/**
 * The check itself, returned rather than thrown: being outside the configured
 * range is an ordinary thing an operator does, not a programmer error, and the
 * caller has to render which end was hit and what the bound is.
 */
export function checkWithinLimits(limits: TopUpLimits, amountMinor: number): LimitCheck {
  if (amountMinor < limits.minAmountMinor) {
    return { ok: false, reason: "below-minimum", limitMinor: limits.minAmountMinor };
  }

  if (amountMinor > limits.maxAmountMinor) {
    return { ok: false, reason: "above-maximum", limitMinor: limits.maxAmountMinor };
  }

  return { ok: true };
}
