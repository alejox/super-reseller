import { describe, expect, it } from "vitest";

import {
  CurrencyMismatchError,
  InvalidMoneyError,
  addMoney,
  compareMoney,
  formatMoney,
  isNegative,
  isZero,
  money,
  multiplyMoney,
  subtractMoney,
} from "@/shared/money/money";

describe("money()", () => {
  // RED (task 3a.1) / GREEN (task 3a.2)
  // EB: Money Is Integer Minor Units With Currency
  it("constructs a frozen Money for an integer amount and a currency code", () => {
    const price = money(150_00, "COP");

    expect(price).toEqual({ amountMinor: 15000, currency: "COP" });
    expect(Object.isFrozen(price)).toBe(true);
  });

  it("throws InvalidMoneyError when the amount is not an integer", () => {
    expect(() => money(150.5, "COP")).toThrow(InvalidMoneyError);
  });

  it("throws InvalidMoneyError when the amount is not a safe integer", () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 1, "COP")).toThrow(
      InvalidMoneyError,
    );
  });

  it("throws InvalidMoneyError when the currency code is missing", () => {
    // @ts-expect-error — exercising the runtime guard for untyped/deserialized input.
    expect(() => money(1500, undefined)).toThrow(InvalidMoneyError);
  });

  it("throws InvalidMoneyError when the currency code is empty", () => {
    expect(() => money(1500, "")).toThrow(InvalidMoneyError);
  });

  it("throws InvalidMoneyError when the currency code is not a 3-letter ISO 4217 code", () => {
    expect(() => money(1500, "cop")).toThrow(InvalidMoneyError);
    expect(() => money(1500, "COPX")).toThrow(InvalidMoneyError);
  });
});

describe("addMoney() / subtractMoney()", () => {
  // RED (task 3a.3) / GREEN (task 3a.4)
  it("adds two Money values of the same currency", () => {
    const sum = addMoney(money(1000, "COP"), money(250, "COP"));

    expect(sum).toEqual({ amountMinor: 1250, currency: "COP" });
  });

  it("subtracts two Money values of the same currency", () => {
    const diff = subtractMoney(money(1000, "COP"), money(250, "COP"));

    expect(diff).toEqual({ amountMinor: 750, currency: "COP" });
  });

  it("throws CurrencyMismatchError when adding differing currencies", () => {
    expect(() => addMoney(money(1000, "COP"), money(250, "USD"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("throws CurrencyMismatchError when subtracting differing currencies", () => {
    expect(() =>
      subtractMoney(money(1000, "COP"), money(250, "USD")),
    ).toThrow(CurrencyMismatchError);
  });
});

describe("multiplyMoney()", () => {
  // RED (task 3a.5) / GREEN (task 3a.6)
  it("returns the exact result for an integer factor", () => {
    const result = multiplyMoney(money(1500, "COP"), 3);

    expect(result).toEqual({ amountMinor: 4500, currency: "COP" });
  });

  it("throws InvalidMoneyError for a non-integer factor", () => {
    expect(() => multiplyMoney(money(1500, "COP"), 1.5)).toThrow(
      InvalidMoneyError,
    );
  });
});

describe("compareMoney()", () => {
  // RED (task 3a.5) / GREEN (task 3a.6)
  it("returns -1 when the first amount is smaller", () => {
    expect(compareMoney(money(100, "COP"), money(200, "COP"))).toBe(-1);
  });

  it("returns 0 when the amounts are equal", () => {
    expect(compareMoney(money(200, "COP"), money(200, "COP"))).toBe(0);
  });

  it("returns 1 when the first amount is larger", () => {
    expect(compareMoney(money(300, "COP"), money(200, "COP"))).toBe(1);
  });

  it("throws CurrencyMismatchError when comparing differing currencies", () => {
    expect(() => compareMoney(money(100, "COP"), money(100, "USD"))).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe("isZero() / isNegative()", () => {
  // RED (task 3a.5) / GREEN (task 3a.6)
  it("isZero is true only for a zero amount", () => {
    expect(isZero(money(0, "COP"))).toBe(true);
    expect(isZero(money(1, "COP"))).toBe(false);
  });

  it("isNegative is true only for a negative amount", () => {
    expect(isNegative(money(-1, "COP"))).toBe(true);
    expect(isNegative(money(0, "COP"))).toBe(false);
    expect(isNegative(money(1, "COP"))).toBe(false);
  });
});

describe("formatMoney()", () => {
  // RED (task 3a.5) / GREEN (task 3a.6)
  it("formats a Money value as localized currency text", () => {
    const formatted = formatMoney(money(150000, "COP"), "es-CO");

    // Locale-formatted currency output varies across ICU/locale data
    // versions; assert on the meaningful content, not exact punctuation.
    expect(formatted.replace(/\D/g, "")).toContain("150");
  });

  it("uses the currency code, not a hardcoded symbol, to select formatting", () => {
    const cop = formatMoney(money(150000, "COP"), "en-US");
    const usd = formatMoney(money(150000, "USD"), "en-US");

    expect(cop).not.toBe(usd);
  });

  it("is presentation-only: it does not mutate the input Money", () => {
    const price = money(150000, "COP");
    formatMoney(price, "es-CO");

    expect(price).toEqual({ amountMinor: 150000, currency: "COP" });
  });
});

describe("Money crosses the Server->Client boundary as plain, frozen data", () => {
  // REFACTOR (task 3a.7): confirm no class or function crosses the module
  // boundary — plain data only. React Server Components silently drop
  // class instances and functions from props (see design decision "Money
  // is a frozen plain object, never a class"); a JSON round trip is the
  // most direct proof that a value is safe to pass across that boundary.
  it("is a plain object, not a class instance", () => {
    const price = money(150000, "COP");

    expect(Object.getPrototypeOf(price)).toBe(Object.prototype);
    expect(price.constructor).toBe(Object);
  });

  it("survives a JSON serialization round trip unchanged", () => {
    const price = money(150000, "COP");

    const roundTripped = JSON.parse(JSON.stringify(price)) as unknown;

    expect(roundTripped).toEqual({ amountMinor: 150000, currency: "COP" });
  });

  it("exposes no function-typed fields that would be dropped by RSC serialization", () => {
    const price = money(150000, "COP");

    for (const value of Object.values(price)) {
      expect(typeof value).not.toBe("function");
    }
  });
});
