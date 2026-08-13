import { describe, expect, it } from "vitest";

import { InvalidMoneyError } from "@/shared/money/money";

import {
  checkWithinLimits,
  createTopUpLimits,
  DEFAULT_TOP_UP_LIMITS,
} from "./top-up-limits";

describe("createTopUpLimits", () => {
  it("keeps a valid range", () => {
    const limits = createTopUpLimits({ minAmountMinor: 20_000, maxAmountMinor: 900_000 });

    expect(limits.minAmountMinor).toBe(20_000);
    expect(limits.maxAmountMinor).toBe(900_000);
    expect(limits.currency).toBe("COP");
  });

  it("allows a range that pins the amount to a single value", () => {
    expect(() => createTopUpLimits({ minAmountMinor: 50_000, maxAmountMinor: 50_000 })).not.toThrow();
  });

  it("refuses an inverted range instead of swapping it", () => {
    // Silently swapping would store a range the operator never typed. A
    // range nobody can satisfy blocks every top-up on the platform.
    expect(() => createTopUpLimits({ minAmountMinor: 900_000, maxAmountMinor: 20_000 })).toThrow(
      InvalidMoneyError,
    );
  });

  it("refuses a non-positive minimum", () => {
    expect(() => createTopUpLimits({ minAmountMinor: 0, maxAmountMinor: 900_000 })).toThrow(
      InvalidMoneyError,
    );
  });

  it("refuses a fractional amount", () => {
    expect(() => createTopUpLimits({ minAmountMinor: 1.5, maxAmountMinor: 900_000 })).toThrow(
      InvalidMoneyError,
    );
  });
});

describe("checkWithinLimits", () => {
  const limits = createTopUpLimits({ minAmountMinor: 10_000, maxAmountMinor: 100_000 });

  it("accepts both bounds", () => {
    expect(checkWithinLimits(limits, 10_000)).toEqual({ ok: true });
    expect(checkWithinLimits(limits, 100_000)).toEqual({ ok: true });
  });

  it("reports which bound was missed and what it is", () => {
    expect(checkWithinLimits(limits, 9_999)).toEqual({
      ok: false,
      reason: "below-minimum",
      limitMinor: 10_000,
    });
    expect(checkWithinLimits(limits, 100_001)).toEqual({
      ok: false,
      reason: "above-maximum",
      limitMinor: 100_000,
    });
  });
});

describe("DEFAULT_TOP_UP_LIMITS", () => {
  it("is a range in COP pesos, not US-dollar cents", () => {
    // The mockup this replaced promised "$10.00 - $1000.00". COP resolves to
    // 0 fraction digits, so those figures would have meant 10 and 1000 PESOS.
    expect(DEFAULT_TOP_UP_LIMITS.currency).toBe("COP");
    expect(DEFAULT_TOP_UP_LIMITS.minAmountMinor).toBe(10_000);
    expect(DEFAULT_TOP_UP_LIMITS.maxAmountMinor).toBe(5_000_000);
  });
});
