// EB: Money Is Integer Minor Units With Currency.
//
// `Money` is a frozen PLAIN OBJECT, never a class. React blocks class
// instances and functions from crossing the Server->Client boundary; a
// class would work in the domain layer and fail silently the first time a
// price reached a Client Component. Do not add methods to the instance —
// every operation is a standalone function over plain, JSON-serializable
// data (see the design decision "Money is a frozen plain object, never a
// class").
//
// `CurrencyCode` is intentionally a validated `string`, not a currency
// literal union. Production only ever mints `"COP"`, but the runtime guard
// below accepts any ISO 4217 alpha-3 code so a currency mismatch (e.g. a
// second currency arriving later, or malformed deserialized input) is
// something this module can actually detect and reject, matching the same
// `currency ~ '^[A-Z]{3}$'` check already used at the database layer.
export type CurrencyCode = string;

export type Money = Readonly<{
  amountMinor: number;
  currency: CurrencyCode;
}>;

/** Thrown when constructing or scaling a `Money` value with invalid input. */
export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

/** Thrown when an operation combines two `Money` values of differing currency. */
export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Currency mismatch: "${a}" vs "${b}"`);
    this.name = "CurrencyMismatchError";
  }
}

const ISO_4217_ALPHA_3 = /^[A-Z]{3}$/;

function assertValidCurrency(currency: unknown): asserts currency is CurrencyCode {
  if (typeof currency !== "string" || !ISO_4217_ALPHA_3.test(currency)) {
    throw new InvalidMoneyError(
      `Money requires an ISO 4217 alpha-3 currency code, got ${JSON.stringify(currency)}.`,
    );
  }
}

function assertValidAmount(amountMinor: unknown): asserts amountMinor is number {
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor)) {
    throw new InvalidMoneyError(
      `Money amount must be a safe integer number of minor units, got ${JSON.stringify(amountMinor)}.`,
    );
  }
}

/**
 * Constructs a frozen `Money` value. Throws `InvalidMoneyError` unless
 * `amountMinor` is a safe integer and `currency` is a 3-letter ISO 4217
 * code — no floating point and no implicit currency ever reach the rest of
 * the codebase.
 */
export function money(amountMinor: number, currency: CurrencyCode): Money {
  assertValidAmount(amountMinor);
  assertValidCurrency(currency);
  return Object.freeze({ amountMinor, currency });
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

/**
 * Adds two `Money` values. Currency mismatch is a programmer error (a
 * single currency is currently in production), so it throws rather than
 * silently coercing — never a `Result` type here.
 */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

/** Subtracts `b` from `a`. Throws `CurrencyMismatchError` on differing currencies. */
export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/**
 * Scales a `Money` value by an integer factor. There is deliberately no
 * `divide` — rounding only arises from division or percentage splits, and
 * this product settled on absolute per-tier prices, so no rounding policy
 * is needed. Do not add one "for completeness"; an unused rounding policy
 * is a bug waiting for a use case (see design decision "Money is a frozen
 * plain object").
 */
export function multiplyMoney(m: Money, factor: number): Money {
  if (!Number.isSafeInteger(factor)) {
    throw new InvalidMoneyError(
      `Money can only be multiplied by an integer factor, got ${JSON.stringify(factor)}.`,
    );
  }
  return money(m.amountMinor * factor, m.currency);
}

/**
 * Compares two `Money` values of the same currency, `Array.prototype.sort`
 * style: -1 when `a` < `b`, 0 when equal, 1 when `a` > `b`. Throws
 * `CurrencyMismatchError` on differing currencies — cross-currency
 * ordering is meaningless without a conversion rate this module does not
 * own.
 */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function isZero(m: Money): boolean {
  return m.amountMinor === 0;
}

export function isNegative(m: Money): boolean {
  return m.amountMinor < 0;
}

/**
 * Formats a `Money` value as localized currency text via
 * `Intl.NumberFormat`. Presentation only — isomorphic, and never mutates
 * or replaces the underlying `Money` value.
 */
export function formatMoney(m: Money, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const majorAmount = m.amountMinor / 10 ** fractionDigits;
  return formatter.format(majorAmount);
}
