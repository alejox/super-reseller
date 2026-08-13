import { beforeEach, describe, expect, it } from "vitest";

import type { CreditBalance } from "../../domain/source-account";
import { FakeSupplierPanel } from "../../infrastructure/fake-supplier-panel";
import {
  InMemoryRechargeAttemptRepository,
  InMemoryRechargeAttemptStore,
} from "../../infrastructure/in-memory-recharge-attempt-repository";
import {
  InMemorySourceAccountRepository,
  InMemorySourceAccountStore,
} from "../../infrastructure/in-memory-source-account-repository";
import { performRecharge, resumeRechargeAttempt, type RechargeDeps } from "./perform-recharge";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const PANEL_URL = "https://syainj.pro-reventa.net/";
const TARGET = "+573112329185";
const PLAN = "Plan de 1 Dispositivo";

const supplierCredits = (points: number): CreditBalance[] => [
  { plan: PLAN, period: "MONTHLY", points },
];

describe("performRecharge", () => {
  let deps: RechargeDeps;
  let panel: FakeSupplierPanel;
  let sourceAccounts: InMemorySourceAccountRepository;
  let attempts: InMemoryRechargeAttemptRepository;
  let sourceId: string;

  beforeEach(async () => {
    panel = new FakeSupplierPanel();
    // The customer account as the panel shows it: 97 available, 6125 lifetime.
    panel.seed(TARGET, [{ plan: PLAN, period: "MONTHLY", available: 97, accumulated: 6125 }]);

    sourceAccounts = new InMemorySourceAccountRepository(new InMemorySourceAccountStore());
    attempts = new InMemoryRechargeAttemptRepository(new InMemoryRechargeAttemptStore());

    const created = await sourceAccounts.create({
      panelUrl: PANEL_URL,
      panelUsername: "MGSALEJO",
      createdBy: ADMIN,
    });
    if (!created.ok) throw new Error("fixture failed");
    sourceId = created.account.id;
    // A live session holding 193 monthly points, as the panel header reports.
    await sourceAccounts.recordSync(sourceId, { ok: true, credits: supplierCredits(193) });

    deps = { sourceAccounts, attempts, panel, actorId: ADMIN };
  });

  const recharge = (points = 1) =>
    performRecharge(deps, {
      sourceAccountId: sourceId,
      targetAccount: TARGET,
      plan: PLAN,
      period: "MONTHLY",
      points,
    });

  describe("the happy path", () => {
    it("confirms against the counter, not against the click", async () => {
      const result = await recharge();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.status).toBe("CONFIRMED");
      expect(result.attempt.accumulatedBefore).toBe(6125);
      expect(result.attempt.accumulatedAfter).toBe(6126);
    });

    // Two reads per recharge: the anchor and the verdict. If this ever drops
    // to one, the verification step was skipped.
    it("reads the panel before AND after", async () => {
      await recharge();

      expect(panel.queries).toBe(2);
      expect(panel.submits).toBe(1);
    });

    it("moves the customer's real balance by the points asked for", async () => {
      await recharge(5);

      const snapshot = panel.snapshot(TARGET)!;
      expect(snapshot.buckets[0].available).toBe(102);
      expect(snapshot.buckets[0].accumulated).toBe(6130);
    });
  });

  describe("the preflight, before any browser opens", () => {
    it("refuses more points than the supplier holds", async () => {
      expect(await recharge(500)).toEqual({
        ok: false,
        reason: "insufficient-credits",
        available: 193,
      });
      expect(panel.queries).toBe(0);
    });

    it("refuses while the session is dead — the balance on file is from the past", async () => {
      await sourceAccounts.recordSync(sourceId, { ok: false, reason: "REQUIRES_2FA" });

      expect(await recharge()).toEqual({ ok: false, reason: "source-not-connected" });
      expect(panel.queries).toBe(0);
    });

    it("refuses an unknown supplier login", async () => {
      const result = await performRecharge(deps, {
        sourceAccountId: "00000000-0000-4000-8000-00000000dead",
        targetAccount: TARGET,
        plan: PLAN,
        period: "MONTHLY",
        points: 1,
      });

      expect(result).toEqual({ ok: false, reason: "source-not-found" });
    });

    it("refuses a target the panel does not know", async () => {
      const result = await performRecharge(deps, {
        sourceAccountId: sourceId,
        targetAccount: "+000000000",
        plan: PLAN,
        period: "MONTHLY",
        points: 1,
      });

      expect(result).toEqual({ ok: false, reason: "target-not-found" });
      // Nothing was clicked, so nothing needs verifying.
      expect(panel.submits).toBe(0);
    });

    // We hold points for the 3-device plan; this customer's row does not carry
    // it. Guessing a starting counter of zero would make the later comparison
    // meaningless, so it stops here instead.
    it("refuses a plan the target account does not carry", async () => {
      await sourceAccounts.recordSync(sourceId, {
        ok: true,
        credits: [
          { plan: PLAN, period: "MONTHLY", points: 193 },
          { plan: "Plan de 3 Dispositivos", period: "MONTHLY", points: 99 },
        ],
      });

      const result = await performRecharge(deps, {
        sourceAccountId: sourceId,
        targetAccount: TARGET,
        plan: "Plan de 3 Dispositivos",
        period: "MONTHLY",
        points: 1,
      });

      expect(result).toEqual({ ok: false, reason: "target-bucket-unknown" });
      expect(panel.submits).toBe(0);
    });

    // The other half of the same rule: we cannot give away points we have
    // never confirmed holding.
    it("refuses a plan the SUPPLIER balance says nothing about", async () => {
      const result = await performRecharge(deps, {
        sourceAccountId: sourceId,
        targetAccount: TARGET,
        plan: "Plan de 3 Dispositivos",
        period: "MONTHLY",
        points: 1,
      });

      expect(result).toEqual({ ok: false, reason: "source-balance-unknown" });
      expect(panel.queries).toBe(0);
    });
  });

  /**
   * The scenarios this whole design exists for. Every one of them passes on a
   * naive implementation that trusts the submit result — and every one of them
   * costs real money in production.
   */
  describe("when the connection dies at the worst possible moment", () => {
    // THE nightmare: the panel applied it, then the wire died, so the caller
    // is told "unknown". A retry here would recharge twice.
    it("CONFIRMS a recharge that landed even though the submit reported unknown", async () => {
      panel.applyThenReportUnknown = true;

      const result = await recharge();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.status).toBe("CONFIRMED");
      expect(result.attempt.accumulatedAfter).toBe(6126);
    });

    // The mirror image: the submit claimed success and nothing moved.
    it("FAILS a recharge the panel silently dropped", async () => {
      panel.failNextSubmit = { ok: false, reason: "rejected", detail: "modal cerrado" };

      const result = await recharge();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.status).toBe("FAILED");
      expect(result.attempt.accumulatedAfter).toBe(6125);
    });

    // Cannot re-read: no evidence either way. This must NOT become FAILED,
    // because FAILED invites a retry and the points may already be gone.
    it("parks the attempt as UNVERIFIED when the counter cannot be re-read", async () => {
      panel.failNextQuery = null;
      const original = panel.query.bind(panel);
      let call = 0;
      panel.query = async (account: string) => {
        call += 1;
        // First read (the anchor) works; the verification read does not.
        if (call === 2) return { ok: false, reason: "session-dead", detail: "sesión caducada" };
        return original(account);
      };

      const result = await recharge();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.status).toBe("UNVERIFIED");
      expect(result.attempt.accumulatedAfter).toBeNull();
      expect(result.attempt.failureDetail).toContain("session-dead");
    });

    // Somebody recharged the same customer by hand while this ran. The delta
    // no longer belongs to this attempt alone, so it cannot be attributed.
    it("parks the attempt as UNVERIFIED when a human recharged concurrently", async () => {
      panel.onAfterSubmit = () => {
        panel.applyRecharge(TARGET, PLAN, "MONTHLY", 4);
      };

      const result = await recharge();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.status).toBe("UNVERIFIED");
      expect(result.attempt.accumulatedAfter).toBe(6130);
    });
  });

  describe("the durable trail", () => {
    // The ordering that makes crash recovery possible at all.
    it("writes the attempt down as SUBMITTED before it clicks", async () => {
      const seen: string[] = [];
      const save = attempts.save.bind(attempts);
      attempts.save = async (attempt) => {
        seen.push(attempt.status);
        return save(attempt);
      };
      panel.failNextSubmit = { ok: false, reason: "session-dead" };

      await recharge();

      // PENDING and SUBMITTED both persisted before the verdict arrived.
      expect(seen.slice(0, 2)).toEqual(["PENDING", "SUBMITTED"]);
    });

    it("leaves nothing open once an attempt settles", async () => {
      await recharge();

      expect(await attempts.listOpen()).toEqual([]);
    });

    it("keeps unverified attempts findable for a human", async () => {
      panel.onAfterSubmit = () => panel.applyRecharge(TARGET, PLAN, "MONTHLY", 4);
      await recharge();

      const unresolved = await attempts.listUnverified();
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].targetAccount).toBe(TARGET);
    });
  });
});

describe("resumeRechargeAttempt", () => {
  let deps: RechargeDeps;
  let panel: FakeSupplierPanel;
  let attempts: InMemoryRechargeAttemptRepository;
  let sourceId: string;

  beforeEach(async () => {
    panel = new FakeSupplierPanel();
    panel.seed(TARGET, [{ plan: PLAN, period: "MONTHLY", available: 97, accumulated: 6125 }]);

    const sourceAccounts = new InMemorySourceAccountRepository(new InMemorySourceAccountStore());
    attempts = new InMemoryRechargeAttemptRepository(new InMemoryRechargeAttemptStore());

    const created = await sourceAccounts.create({
      panelUrl: PANEL_URL,
      panelUsername: "MGSALEJO",
      createdBy: ADMIN,
    });
    if (!created.ok) throw new Error("fixture failed");
    sourceId = created.account.id;
    await sourceAccounts.recordSync(sourceId, { ok: true, credits: supplierCredits(193) });

    deps = { sourceAccounts, attempts, panel, actorId: ADMIN };
  });

  /**
   * The crash scenario end to end: the process dies mid-click, leaving a
   * SUBMITTED row. Recovery must VERIFY it, never re-click it.
   */
  async function crashDuringSubmit(): Promise<string> {
    panel.submitRecharge = async (command) => {
      // The panel commits, then the process dies before the response.
      panel.applyRecharge(command.targetAccount, command.plan, command.period, command.points);
      throw new Error("process killed mid-click");
    };

    await expect(
      performRecharge(deps, {
        sourceAccountId: sourceId,
        targetAccount: TARGET,
        plan: PLAN,
        period: "MONTHLY",
        points: 1,
      }),
    ).rejects.toThrow("process killed mid-click");

    const open = await attempts.listOpen();
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe("SUBMITTED");
    return open[0].id;
  }

  it("recovers a crashed attempt by asking the counter, not by re-clicking", async () => {
    const attemptId = await crashDuringSubmit();
    const submitsBefore = panel.submits;

    const result = await resumeRechargeAttempt(deps, attemptId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The recharge HAD landed before the crash — recovery finds that out.
    expect(result.attempt.status).toBe("CONFIRMED");
    expect(panel.submits).toBe(submitsBefore);
  });

  it("marks a crash that never reached the panel as FAILED, which is safe to retry", async () => {
    panel.submitRecharge = async () => {
      throw new Error("process killed mid-click");
    };

    await expect(
      performRecharge(deps, {
        sourceAccountId: sourceId,
        targetAccount: TARGET,
        plan: PLAN,
        period: "MONTHLY",
        points: 1,
      }),
    ).rejects.toThrow();

    const open = await attempts.listOpen();
    const result = await resumeRechargeAttempt(deps, open[0].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempt.status).toBe("FAILED");
  });

  it("refuses to touch an attempt that already settled", async () => {
    await performRecharge(deps, {
      sourceAccountId: sourceId,
      targetAccount: TARGET,
      plan: PLAN,
      period: "MONTHLY",
      points: 1,
    });
    const [settled] = await attempts.listRecent(sourceId, 1);

    expect(await resumeRechargeAttempt(deps, settled.id)).toEqual({
      ok: false,
      reason: "already-settled",
    });
  });

  it("reports an unknown attempt", async () => {
    expect(await resumeRechargeAttempt(deps, "00000000-0000-4000-8000-00000000dead")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});
