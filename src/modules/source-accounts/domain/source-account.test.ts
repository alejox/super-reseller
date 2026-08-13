import { describe, expect, it } from "vitest";

import {
  canRecharge,
  createSourceAccount,
  creditKey,
  InvalidSourceAccountError,
  isSyncFailureReason,
  lowCredits,
  needsAttention,
  pointsAvailable,
  recordSyncFailure,
  recordSyncSuccess,
  type CreditBalance,
  type NewSourceAccountInput,
  type SourceAccount,
} from "./source-account";

const input = (overrides: Partial<NewSourceAccountInput> = {}): NewSourceAccountInput => ({
  panelUrl: "https://syainj.pro-reventa.net/",
  panelUsername: "MGSALEJO",
  createdBy: "22222222-2222-2222-2222-222222222222",
  createdAt: new Date("2026-08-13T10:00:00.000Z"),
  ...overrides,
});

/** The two buckets actually used, in the shape the panel reports them. */
const credits = (monthlyOneDevice: number, monthlyThreeDevices: number): CreditBalance[] => [
  { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: monthlyOneDevice },
  { plan: "Plan de 3 Dispositivos", period: "MONTHLY", points: monthlyThreeDevices },
];

const synced = (overrides: Partial<SourceAccount> = {}): SourceAccount =>
  Object.freeze({
    ...recordSyncSuccess(
      createSourceAccount(input()),
      new Date("2026-08-13T11:00:00.000Z"),
      credits(193, 99),
    ),
    ...overrides,
  });

describe("createSourceAccount", () => {
  it("starts life never connected, with no sync and no credits known", () => {
    const account = createSourceAccount(input());

    expect(account.connectionStatus).toBe("NEVER_CONNECTED");
    expect(account.lastSyncAt).toBeNull();
    expect(account.lastSyncError).toBeNull();
    expect(account.consecutiveFailures).toBe(0);
    // Not "zero credits" — UNKNOWN credits. Nobody has looked yet, and an
    // empty balance would read as "the supplier has nothing left".
    expect(account.credits).toEqual([]);
    expect(account.archivedAt).toBeNull();
  });

  it("trims the panel username and the url", () => {
    const account = createSourceAccount(
      input({ panelUsername: "  MGSALEJO  ", panelUrl: "  https://x.net/  " }),
    );

    expect(account.panelUsername).toBe("MGSALEJO");
    expect(account.panelUrl).toBe("https://x.net/");
  });

  it.each(["panelUsername", "panelUrl"] as const)("rejects a blank %s", (field) => {
    expect(() => createSourceAccount(input({ [field]: "   " }))).toThrow(InvalidSourceAccountError);
  });

  it("normalises an empty label to null rather than an empty string", () => {
    expect(createSourceAccount(input({ label: "   " })).label).toBeNull();
  });
});

describe("recordSyncSuccess", () => {
  it("marks the account connected, stamps the clock and mirrors the balances", () => {
    const at = new Date("2026-08-13T12:00:00.000Z");
    const account = recordSyncSuccess(createSourceAccount(input()), at, credits(193, 99));

    expect(account.connectionStatus).toBe("CONNECTED");
    expect(account.lastSyncAt).toEqual(at);
    expect(account.credits).toEqual(credits(193, 99));
  });

  it("clears the failure streak and the stale error message", () => {
    const failing = recordSyncFailure(
      createSourceAccount(input()),
      "LOGIN_ERROR",
      new Date("2026-08-13T12:00:00.000Z"),
      "sesión vencida",
    );

    const recovered = recordSyncSuccess(failing, new Date("2026-08-13T13:00:00.000Z"), credits(1, 1));

    expect(recovered.consecutiveFailures).toBe(0);
    expect(recovered.lastSyncError).toBeNull();
  });

  // The balances are the SUPPLIER's truth, re-read every sync. A merge would
  // keep a bucket alive after the supplier stopped reporting it.
  it("REPLACES the balances rather than merging them", () => {
    const first = recordSyncSuccess(createSourceAccount(input()), new Date(), credits(193, 99));

    const second = recordSyncSuccess(first, new Date(), [
      { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: 12 },
    ]);

    expect(second.credits).toEqual([
      { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: 12 },
    ]);
  });

  it("rejects a negative balance — the panel never reports one", () => {
    expect(() =>
      recordSyncSuccess(createSourceAccount(input()), new Date(), [
        { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: -1 },
      ]),
    ).toThrow(InvalidSourceAccountError);
  });
});

describe("recordSyncFailure", () => {
  it.each(["LOGIN_ERROR", "REQUIRES_2FA", "BLOCKED"] as const)(
    "adopts %s as the connection status",
    (reason) => {
      const account = recordSyncFailure(createSourceAccount(input()), reason, new Date(), null);

      expect(account.connectionStatus).toBe(reason);
    },
  );

  it("stamps lastSyncAt even though the attempt failed", () => {
    const at = new Date("2026-08-13T12:00:00.000Z");
    const account = recordSyncFailure(createSourceAccount(input()), "BLOCKED", at, null);

    expect(account.lastSyncAt).toEqual(at);
  });

  // The last balances stay: they are stale, not wrong, and `lastSyncAt` already
  // says how stale. Wiping them would blank the operator's screen at the exact
  // moment they need to know what was there.
  it("keeps the last known balances", () => {
    const account = recordSyncFailure(synced(), "LOGIN_ERROR", new Date(), null);

    expect(account.credits).toEqual(credits(193, 99));
  });

  it("counts consecutive failures across attempts", () => {
    let account = createSourceAccount(input());
    for (const n of [1, 2, 3]) {
      account = recordSyncFailure(account, "LOGIN_ERROR", new Date(), null);
      expect(account.consecutiveFailures).toBe(n);
    }
  });
});

describe("needsAttention", () => {
  const failTimes = (times: number): SourceAccount => {
    let account = createSourceAccount(input());
    for (let i = 0; i < times; i += 1) {
      account = recordSyncFailure(account, "LOGIN_ERROR", new Date(), null);
    }
    return account;
  };

  it("stays quiet below the threshold", () => {
    expect(needsAttention(failTimes(2), 3)).toBe(false);
  });

  it("fires at the threshold and stays on past it", () => {
    expect(needsAttention(failTimes(3), 3)).toBe(true);
    expect(needsAttention(failTimes(4), 3)).toBe(true);
  });

  it("fires immediately when the account is blocked, whatever the streak", () => {
    const blocked = recordSyncFailure(createSourceAccount(input()), "BLOCKED", new Date(), null);

    expect(blocked.consecutiveFailures).toBe(1);
    expect(needsAttention(blocked, 3)).toBe(true);
  });

  it("never fires on a healthy account", () => {
    expect(needsAttention(synced(), 3)).toBe(false);
  });

  it("never fires on an archived account — it is out of service on purpose", () => {
    expect(needsAttention({ ...failTimes(9), archivedAt: new Date() }, 3)).toBe(false);
  });
});

describe("pointsAvailable", () => {
  it("reads the bucket the panel reported", () => {
    expect(pointsAvailable(synced(), "Plan de 1 Dispositivo", "MONTHLY")).toBe(193);
    expect(pointsAvailable(synced(), "Plan de 3 Dispositivos", "MONTHLY")).toBe(99);
  });

  // Zero and "never looked" are different facts, and conflating them is how a
  // recharge gets refused on an account that is actually full.
  it("returns null for a bucket that was never reported", () => {
    expect(pointsAvailable(synced(), "Plan de 1 Dispositivo", "ANNUAL")).toBeNull();
    expect(pointsAvailable(createSourceAccount(input()), "Plan de 1 Dispositivo", "MONTHLY"))
      .toBeNull();
  });
});

describe("canRecharge", () => {
  it("allows a recharge covered by the balance", () => {
    expect(canRecharge(synced(), "Plan de 1 Dispositivo", "MONTHLY", 5)).toEqual({ ok: true });
  });

  it("allows spending the balance down to exactly zero", () => {
    expect(canRecharge(synced(), "Plan de 3 Dispositivos", "MONTHLY", 99)).toEqual({ ok: true });
  });

  it("refuses more points than the supplier holds", () => {
    expect(canRecharge(synced(), "Plan de 3 Dispositivos", "MONTHLY", 100)).toEqual({
      ok: false,
      reason: "insufficient-credits",
      available: 99,
    });
  });

  // A connected account asking about a bucket the panel never reported — the
  // annual points, which this operator does not buy. "not-connected" is
  // checked FIRST and deliberately: on a dead session every balance is a
  // number from the past, so there is nothing to reason about yet.
  it("refuses a bucket nobody has read yet rather than guessing", () => {
    expect(canRecharge(synced(), "Plan de 1 Dispositivo", "ANNUAL", 1)).toEqual({
      ok: false,
      reason: "balance-unknown",
    });
  });

  it.each([0, -1, 2.5])("refuses a quantity of %s", (points) => {
    expect(canRecharge(synced(), "Plan de 1 Dispositivo", "MONTHLY", points)).toEqual({
      ok: false,
      reason: "invalid-quantity",
    });
  });

  it.each(["NEVER_CONNECTED", "LOGIN_ERROR", "REQUIRES_2FA", "BLOCKED"] as const)(
    "refuses while the connection is %s — the balance on screen is stale",
    (connectionStatus) => {
      expect(canRecharge(synced({ connectionStatus }), "Plan de 1 Dispositivo", "MONTHLY", 1))
        .toEqual({ ok: false, reason: "not-connected" });
    },
  );

  it("refuses an archived account", () => {
    expect(canRecharge(synced({ archivedAt: new Date() }), "Plan de 1 Dispositivo", "MONTHLY", 1))
      .toEqual({ ok: false, reason: "not-connected" });
  });
});

describe("lowCredits", () => {
  // The supplier pool is FINITE, unlike the reseller's COP balance which the
  // platform issues. Running out stops every recharge, so it needs a warning
  // with room to react.
  it("names the buckets at or below the threshold", () => {
    expect(lowCredits(synced(), 100)).toEqual([
      { plan: "Plan de 3 Dispositivos", period: "MONTHLY", points: 99 },
    ]);
  });

  it("says nothing when every bucket is comfortable", () => {
    expect(lowCredits(synced(), 10)).toEqual([]);
  });

  it("says nothing about an account nobody has read yet", () => {
    expect(lowCredits(createSourceAccount(input()), 100)).toEqual([]);
  });
});

describe("creditKey", () => {
  it("is stable for the same bucket and distinct across buckets", () => {
    expect(creditKey("Plan de 1 Dispositivo", "MONTHLY")).toBe(
      creditKey("Plan de 1 Dispositivo", "MONTHLY"),
    );
    expect(creditKey("Plan de 1 Dispositivo", "MONTHLY")).not.toBe(
      creditKey("Plan de 1 Dispositivo", "ANNUAL"),
    );
  });
});

describe("isSyncFailureReason", () => {
  it("accepts the known reasons and rejects anything else", () => {
    expect(isSyncFailureReason("REQUIRES_2FA")).toBe(true);
    expect(isSyncFailureReason("CONNECTED")).toBe(false);
    expect(isSyncFailureReason("whatever")).toBe(false);
  });
});
