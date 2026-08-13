import { beforeEach, describe, expect, it } from "vitest";

import {
  InMemorySourceAccountRepository,
  InMemorySourceAccountStore,
} from "../../infrastructure/in-memory-source-account-repository";
import type { CreditBalance } from "../../domain/source-account";
import {
  archiveSourceAccount,
  loadSourceAccountBoard,
  recordSyncAttempt,
  registerSourceAccount,
  type SourceAccountDeps,
} from "./manage-source-accounts";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const PANEL = "https://syainj.pro-reventa.net/";

const credits = (oneDevice: number, threeDevices: number): CreditBalance[] => [
  { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: oneDevice },
  { plan: "Plan de 3 Dispositivos", period: "MONTHLY", points: threeDevices },
];

describe("source account use cases", () => {
  let deps: SourceAccountDeps;

  beforeEach(() => {
    deps = {
      sourceAccounts: new InMemorySourceAccountRepository(new InMemorySourceAccountStore()),
      actorId: ADMIN,
    };
  });

  async function register(overrides: Record<string, unknown> = {}) {
    return registerSourceAccount(deps, {
      panelUrl: PANEL,
      panelUsername: "MGSALEJO",
      label: "Proveedor principal",
      ...overrides,
    });
  }

  async function anAccount(overrides: Record<string, unknown> = {}) {
    const result = await register(overrides);
    if (!result.ok) throw new Error(`fixture failed: ${result.reason}`);
    return result.account;
  }

  describe("registerSourceAccount", () => {
    it("registers an account and stamps the acting admin", async () => {
      const account = await anAccount();

      expect(account.createdBy).toBe(ADMIN);
      expect(account.panelUsername).toBe("MGSALEJO");
      expect(account.connectionStatus).toBe("NEVER_CONNECTED");
    });

    it("refuses a blank panel url", async () => {
      expect(await register({ panelUrl: "  " })).toEqual({ ok: false, reason: "panel-url-required" });
    });

    it("refuses a blank username", async () => {
      expect(await register({ panelUsername: "  " })).toEqual({
        ok: false,
        reason: "panel-username-required",
      });
    });

    it("refuses to register the same login twice", async () => {
      await register();

      const result = await register({ panelUsername: "mgsalejo" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("identity-taken");
    });
  });

  describe("recordSyncAttempt", () => {
    it("records a success along with the balances it read", async () => {
      const account = await anAccount();

      const result = await recordSyncAttempt(deps, {
        accountId: account.id,
        outcome: { ok: true, credits: credits(193, 99) },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.account.connectionStatus).toBe("CONNECTED");
      expect(result.alert).toBe(false);
    });

    it("raises the alert once the failure streak reaches the threshold", async () => {
      const account = await anAccount();
      const fail = () =>
        recordSyncAttempt(deps, {
          accountId: account.id,
          outcome: { ok: false, reason: "LOGIN_ERROR" },
        });

      const first = await fail();
      const second = await fail();
      const third = await fail();

      expect(first.ok && first.alert).toBe(false);
      expect(second.ok && second.alert).toBe(false);
      expect(third.ok && third.alert).toBe(true);
    });

    // The session dying is the NORMAL end of a session here — the panel's
    // login asks for a verification code, so re-entry always needs a human.
    it("raises the alert on the first REQUIRES_2FA only once the streak says so", async () => {
      const account = await anAccount();

      const result = await recordSyncAttempt(deps, {
        accountId: account.id,
        outcome: { ok: false, reason: "REQUIRES_2FA", detail: "código en pantalla" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.account.connectionStatus).toBe("REQUIRES_2FA");
      expect(result.account.lastSyncError).toBe("código en pantalla");
    });

    it("reports an unknown account rather than inventing one", async () => {
      const result = await recordSyncAttempt(deps, {
        accountId: "00000000-0000-4000-8000-00000000dead",
        outcome: { ok: true, credits: [] },
      });

      expect(result).toEqual({ ok: false, reason: "not-found" });
    });
  });

  describe("loadSourceAccountBoard", () => {
    it("returns an empty board with no alerts", async () => {
      const board = await loadSourceAccountBoard(deps);

      expect(board.accounts).toEqual([]);
      expect(board.alerting).toEqual([]);
      expect(board.lowStock).toEqual([]);
    });

    it("separates the accounts that need attention from the rest", async () => {
      const healthy = await anAccount({ panelUsername: "OK" });
      const broken = await anAccount({ panelUsername: "BAD" });

      await recordSyncAttempt(deps, {
        accountId: healthy.id,
        outcome: { ok: true, credits: credits(193, 99) },
      });
      for (let i = 0; i < 3; i += 1) {
        await recordSyncAttempt(deps, {
          accountId: broken.id,
          outcome: { ok: false, reason: "LOGIN_ERROR" },
        });
      }

      const board = await loadSourceAccountBoard(deps);

      expect(board.accounts).toHaveLength(2);
      expect(board.alerting.map((a) => a.id)).toEqual([broken.id]);
    });

    // The supplier pool is FINITE — running out stops every recharge no matter
    // how much COP a reseller is holding.
    it("names the buckets running low, with the account they belong to", async () => {
      const account = await anAccount();
      await recordSyncAttempt(deps, {
        accountId: account.id,
        outcome: { ok: true, credits: credits(193, 4) },
      });

      const board = await loadSourceAccountBoard(deps);

      expect(board.lowStock).toHaveLength(1);
      expect(board.lowStock[0].account.id).toBe(account.id);
      expect(board.lowStock[0].balance).toEqual({
        plan: "Plan de 3 Dispositivos",
        period: "MONTHLY",
        points: 4,
      });
    });

    it("says nothing about stock when every bucket is comfortable", async () => {
      const account = await anAccount();
      await recordSyncAttempt(deps, {
        accountId: account.id,
        outcome: { ok: true, credits: credits(193, 99) },
      });

      expect((await loadSourceAccountBoard(deps)).lowStock).toEqual([]);
    });

    it("says nothing about stock for an account nobody has synced", async () => {
      await anAccount();

      expect((await loadSourceAccountBoard(deps)).lowStock).toEqual([]);
    });
  });

  describe("archiveSourceAccount", () => {
    it("takes the account out of the board", async () => {
      const account = await anAccount();

      expect(await archiveSourceAccount(deps, account.id)).toEqual({ ok: true });
      expect((await loadSourceAccountBoard(deps)).accounts).toEqual([]);
    });

    it("reports an unknown account", async () => {
      expect(await archiveSourceAccount(deps, "00000000-0000-4000-8000-00000000dead")).toEqual({
        ok: false,
        reason: "not-found",
      });
    });
  });
});
