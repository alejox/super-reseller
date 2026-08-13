import { describe, expect, it } from "vitest";

import {
  classifyOutcome,
  InvalidRechargeAttemptError,
  markSubmitted,
  markUnverifiable,
  openRechargeAttempt,
  RechargeAttemptNotOpenError,
  settleAttempt,
  type NewRechargeAttemptInput,
  type RechargeAttempt,
} from "./recharge-attempt";

const input = (overrides: Partial<NewRechargeAttemptInput> = {}): NewRechargeAttemptInput => ({
  sourceAccountId: "11111111-1111-1111-1111-111111111111",
  targetAccount: "+573112329185",
  plan: "Plan de 1 Dispositivo",
  period: "MONTHLY",
  points: 1,
  accumulatedBefore: 6125,
  createdBy: "22222222-2222-2222-2222-222222222222",
  createdAt: new Date("2026-08-13T10:00:00.000Z"),
  ...overrides,
});

const submitted = (overrides: Partial<RechargeAttempt> = {}): RechargeAttempt =>
  Object.freeze({
    ...markSubmitted(openRechargeAttempt(input()), new Date("2026-08-13T10:00:01.000Z")),
    ...overrides,
  });

describe("openRechargeAttempt", () => {
  it("starts PENDING with the anchor captured and nothing settled", () => {
    const attempt = openRechargeAttempt(input());

    expect(attempt.status).toBe("PENDING");
    expect(attempt.accumulatedBefore).toBe(6125);
    expect(attempt.accumulatedAfter).toBeNull();
    expect(attempt.submittedAt).toBeNull();
    expect(attempt.settledAt).toBeNull();
  });

  it("trims the target account", () => {
    expect(openRechargeAttempt(input({ targetAccount: "  +573112329185 " })).targetAccount).toBe(
      "+573112329185",
    );
  });

  it("rejects a blank target account", () => {
    expect(() => openRechargeAttempt(input({ targetAccount: "  " }))).toThrow(
      InvalidRechargeAttemptError,
    );
  });

  it("rejects a blank plan", () => {
    expect(() => openRechargeAttempt(input({ plan: " " }))).toThrow(InvalidRechargeAttemptError);
  });

  it.each([0, -1, 1.5])("rejects %s points", (points) => {
    expect(() => openRechargeAttempt(input({ points }))).toThrow(InvalidRechargeAttemptError);
  });

  // A negative anchor means the scrape misread the page. Recording it would
  // poison every later comparison against it.
  it.each([-1, 2.5])("rejects an anchor of %s", (accumulatedBefore) => {
    expect(() => openRechargeAttempt(input({ accumulatedBefore }))).toThrow(
      InvalidRechargeAttemptError,
    );
  });
});

describe("markSubmitted", () => {
  it("records that the click happened, or may have", () => {
    const at = new Date("2026-08-13T10:00:01.000Z");
    const attempt = markSubmitted(openRechargeAttempt(input()), at);

    expect(attempt.status).toBe("SUBMITTED");
    expect(attempt.submittedAt).toEqual(at);
  });

  it("refuses to submit anything that is not PENDING", () => {
    expect(() => markSubmitted(submitted(), new Date())).toThrow(RechargeAttemptNotOpenError);
  });
});

/**
 * The heart of the protocol. "Puntos acumulados" only ever grows, so the delta
 * between the anchor and a later read is the whole evidence base.
 */
describe("classifyOutcome", () => {
  it("confirms an exact delta", () => {
    expect(classifyOutcome(6125, 6126, 1)).toBe("CONFIRMED");
    expect(classifyOutcome(6125, 6130, 5)).toBe("CONFIRMED");
  });

  // Nothing moved: the click never landed. This is the ONLY case where
  // retrying is safe.
  it("fails an unchanged counter", () => {
    expect(classifyOutcome(6125, 6125, 1)).toBe("FAILED");
  });

  // Somebody recharged the same account by hand while this ran, or the panel
  // applied something other than what was asked. Either way the delta can no
  // longer be attributed to this attempt, and guessing is how an account gets
  // charged twice.
  it("refuses to attribute an unexpected delta", () => {
    expect(classifyOutcome(6125, 6131, 1)).toBe("UNVERIFIED");
    expect(classifyOutcome(6125, 6127, 5)).toBe("UNVERIFIED");
  });

  // Impossible against a monotonic counter: the scrape read the wrong number,
  // the wrong row, or the wrong account.
  it("refuses a counter that went backwards", () => {
    expect(classifyOutcome(6125, 6124, 1)).toBe("UNVERIFIED");
  });
});

describe("settleAttempt", () => {
  it("confirms when the counter moved by exactly the points asked for", () => {
    const at = new Date("2026-08-13T10:00:05.000Z");
    const settled = settleAttempt(submitted(), 6126, at);

    expect(settled.status).toBe("CONFIRMED");
    expect(settled.accumulatedAfter).toBe(6126);
    expect(settled.settledAt).toEqual(at);
  });

  it("fails when the counter never moved", () => {
    expect(settleAttempt(submitted(), 6125, new Date()).status).toBe("FAILED");
  });

  it("leaves an ambiguous delta UNVERIFIED for a human", () => {
    expect(settleAttempt(submitted(), 6131, new Date()).status).toBe("UNVERIFIED");
  });

  // Settling a PENDING attempt is legitimate and matters: it is the recovery
  // path for a crash BEFORE the click, where nothing was submitted at all.
  it("settles a PENDING attempt too", () => {
    expect(settleAttempt(openRechargeAttempt(input()), 6125, new Date()).status).toBe("FAILED");
  });

  it.each(["CONFIRMED", "FAILED", "UNVERIFIED"] as const)(
    "refuses to re-settle a %s attempt",
    (status) => {
      expect(() => settleAttempt(submitted({ status }), 6126, new Date())).toThrow(
        RechargeAttemptNotOpenError,
      );
    },
  );
});

describe("markUnverifiable", () => {
  // The panel could not be read at all — session died mid-flight. This is NOT
  // a failure: the recharge may well have landed, and calling it failed is
  // exactly how a retry double-charges.
  it("parks the attempt for a human with the reason attached", () => {
    const at = new Date("2026-08-13T10:00:09.000Z");
    const parked = markUnverifiable(submitted(), "la sesión caducó al reconsultar", at);

    expect(parked.status).toBe("UNVERIFIED");
    expect(parked.accumulatedAfter).toBeNull();
    expect(parked.failureDetail).toBe("la sesión caducó al reconsultar");
    expect(parked.settledAt).toEqual(at);
  });

  it("requires a reason", () => {
    expect(() => markUnverifiable(submitted(), "   ", new Date())).toThrow(
      InvalidRechargeAttemptError,
    );
  });

  it("refuses to park an already settled attempt", () => {
    expect(() => markUnverifiable(submitted({ status: "CONFIRMED" }), "x", new Date())).toThrow(
      RechargeAttemptNotOpenError,
    );
  });
});
