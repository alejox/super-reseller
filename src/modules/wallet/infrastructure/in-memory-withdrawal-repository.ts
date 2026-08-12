import type { ResellerId, UserId } from "../domain/ids";
import { createWalletEntry } from "../domain/wallet-entry";
import type {
  NewWithdrawalMethodInput,
  UpdateWithdrawalSettingsInput,
  WithdrawalMethod,
  WithdrawalRepository,
  WithdrawalSettings,
} from "../domain/withdrawal";
import { DEFAULT_WITHDRAWAL_SETTINGS } from "../domain/withdrawal";
import type {
  OpenWithdrawalCommand,
  OpenWithdrawalOutcome,
  WithdrawalRequestRepository,
} from "../domain/withdrawal-request-repository";
import {
  approveWithdrawal,
  createWithdrawalRequest,
  rejectWithdrawal,
  settleWithdrawal,
  type WithdrawalRequest,
  type WithdrawalRequestId,
} from "../domain/withdrawal-request";
import type { InMemoryWalletStore } from "./in-memory-wallet-repository";

/**
 * The withdrawal rows, independent of who is reading them — same split as
 * `InMemoryWalletStore`, for the same reason: two repositories must be able
 * to see ONE set of rows, or a test proving that a method belongs to another
 * reseller would pass because the method simply is not there.
 */
export class InMemoryWithdrawalStore {
  readonly methods: WithdrawalMethod[] = [];
  readonly settings = new Map<ResellerId, WithdrawalSettings>();
  readonly requests: WithdrawalRequest[] = [];
}

export class InMemoryWithdrawalRepository implements WithdrawalRepository {
  constructor(private readonly store: InMemoryWithdrawalStore) {}

  async getMethods(resellerId: ResellerId): Promise<readonly WithdrawalMethod[]> {
    return this.store.methods.filter((method) => method.resellerId === resellerId);
  }

  async addMethod(input: NewWithdrawalMethodInput): Promise<WithdrawalMethod> {
    const now = new Date();
    const method: WithdrawalMethod = Object.freeze({
      id: crypto.randomUUID(),
      resellerId: input.resellerId,
      type: input.type,
      details: input.details,
      isPrimary: input.isPrimary ?? false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    this.store.methods.push(method);
    return method;
  }

  // Mirrors the adapter's `and(id, resellerId)` predicate exactly: an id
  // alone is never enough to write somebody else's row.
  async setPrimaryMethod(resellerId: ResellerId, methodId: string): Promise<void> {
    this.replaceOwned(resellerId, (method) => ({
      ...method,
      isPrimary: method.id === methodId,
    }));
  }

  async deactivateMethod(resellerId: ResellerId, methodId: string): Promise<void> {
    this.replaceOwned(resellerId, (method) =>
      method.id === methodId ? { ...method, isActive: false } : method,
    );
  }

  private replaceOwned(
    resellerId: ResellerId,
    map: (method: WithdrawalMethod) => WithdrawalMethod,
  ): void {
    for (const [index, method] of this.store.methods.entries()) {
      if (method.resellerId !== resellerId) continue;
      this.store.methods[index] = Object.freeze(map(method));
    }
  }

  async getSettings(resellerId: ResellerId): Promise<WithdrawalSettings | null> {
    return this.store.settings.get(resellerId) ?? null;
  }

  async upsertSettings(input: UpdateWithdrawalSettingsInput): Promise<WithdrawalSettings> {
    const existing = this.store.settings.get(input.resellerId);
    const now = new Date();
    const base = existing ?? {
      ...DEFAULT_WITHDRAWAL_SETTINGS,
      resellerId: input.resellerId,
      createdAt: now,
      updatedAt: now,
    };

    const settings: WithdrawalSettings = Object.freeze({
      ...base,
      autoWithdraw: input.autoWithdraw ?? base.autoWithdraw,
      condition: input.condition ?? base.condition,
      thresholdAmountMinor: input.thresholdAmountMinor ?? base.thresholdAmountMinor,
      scheduleFrequency: input.scheduleFrequency ?? base.scheduleFrequency,
      minWithdrawalMinor: input.minWithdrawalMinor ?? base.minWithdrawalMinor,
      maxDailyWithdrawalMinor: input.maxDailyWithdrawalMinor ?? base.maxDailyWithdrawalMinor,
      updatedAt: now,
    });

    this.store.settings.set(input.resellerId, settings);
    return settings;
  }
}

/** Midnight UTC of `at`'s day — the window `maxDailyWithdrawalMinor` covers. */
export function startOfDayUtc(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/**
 * Test double for `WithdrawalRequestRepository`.
 *
 * It reads the balance out of the SHARED `InMemoryWalletStore` rather than
 * keeping its own number, so the fake cannot pass a drain test the real
 * transaction would fail. What it deliberately does NOT model is concurrency:
 * JavaScript's single turn makes the read-check-write here atomic for free,
 * while Postgres needs `pg_advisory_xact_lock` for the same guarantee. That
 * is the adapter's job to prove, not this one's.
 */
export class InMemoryWithdrawalRequestRepository implements WithdrawalRequestRepository {
  constructor(
    private readonly store: InMemoryWithdrawalStore,
    private readonly walletStore: InMemoryWalletStore,
  ) {}

  async openRequest(command: OpenWithdrawalCommand): Promise<OpenWithdrawalOutcome> {
    const now = new Date();

    const balanceMinor = this.walletStore.entries
      .filter((entry) => entry.resellerId === command.resellerId)
      .reduce((total, entry) => total + entry.amountMinor, 0);

    if (balanceMinor < command.amountMinor) {
      return { ok: false, reason: "insufficient-funds", balanceMinor };
    }

    const since = startOfDayUtc(now);
    const withdrawnTodayMinor = this.store.requests
      .filter(
        (request) =>
          request.resellerId === command.resellerId &&
          // A rejected request gave the money back, so it never consumed any
          // of the day's allowance.
          request.status !== "REJECTED" &&
          request.requestedAt >= since,
      )
      .reduce((total, request) => total + request.amountMinor, 0);

    if (withdrawnTodayMinor + command.amountMinor > command.maxDailyWithdrawalMinor) {
      return {
        ok: false,
        reason: "daily-limit-exceeded",
        withdrawnTodayMinor,
        limitMinor: command.maxDailyWithdrawalMinor,
      };
    }

    const entry = createWalletEntry({
      resellerId: command.resellerId,
      kind: "WITHDRAWAL",
      // NEGATIVE: money left the wallet the moment the request opened.
      amountMinor: -command.amountMinor,
      currency: command.currency,
      createdBy: command.requestedBy,
      createdAt: now,
    });
    this.walletStore.entries.push(entry);

    const request = createWithdrawalRequest({
      resellerId: command.resellerId,
      methodId: command.methodId,
      amountMinor: command.amountMinor,
      currency: command.currency,
      walletEntryId: entry.id,
      requestedBy: command.requestedBy,
      requestedAt: now,
    });
    this.store.requests.push(request);

    return { ok: true, request };
  }

  async listRequests(resellerId?: ResellerId): Promise<readonly WithdrawalRequest[]> {
    return this.store.requests
      .filter((request) => resellerId === undefined || request.resellerId === resellerId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  async getRequest(id: WithdrawalRequestId): Promise<WithdrawalRequest | null> {
    return this.store.requests.find((request) => request.id === id) ?? null;
  }

  async approve(
    id: WithdrawalRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<WithdrawalRequest | null> {
    return this.transition(id, (request) =>
      approveWithdrawal(request, reviewedBy, new Date(), note),
    );
  }

  async reject(
    id: WithdrawalRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<WithdrawalRequest | null> {
    const existing = await this.getRequest(id);
    if (existing === null || existing.status !== "PENDING_REVIEW") return null;

    // The debit is not undone — the ledger is append-only. The money comes
    // back as a new entry with the opposite sign.
    const reversal = createWalletEntry({
      resellerId: existing.resellerId,
      kind: "WITHDRAWAL",
      amountMinor: existing.amountMinor,
      currency: existing.currency,
      memo: `Reversal of withdrawal ${existing.id}`,
      createdBy: reviewedBy,
    });
    this.walletStore.entries.push(reversal);

    return this.transition(id, (request) =>
      rejectWithdrawal(request, reviewedBy, new Date(), note, reversal.id),
    );
  }

  async settle(id: WithdrawalRequestId, note: string | null): Promise<WithdrawalRequest | null> {
    return this.transition(id, (request) => settleWithdrawal(request, new Date(), note));
  }

  /**
   * Returns `null` instead of throwing when the domain refuses the move:
   * "already reviewed" and "does not exist" are the same answer to a caller
   * — nothing to do — which is the convention `fulfilOrder` already set.
   */
  private transition(
    id: WithdrawalRequestId,
    move: (request: WithdrawalRequest) => WithdrawalRequest,
  ): WithdrawalRequest | null {
    const index = this.store.requests.findIndex((request) => request.id === id);
    if (index === -1) return null;

    try {
      const next = move(this.store.requests[index]);
      this.store.requests[index] = next;
      return next;
    } catch {
      return null;
    }
  }
}
