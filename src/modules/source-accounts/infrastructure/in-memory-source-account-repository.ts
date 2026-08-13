import type { SourceAccountId } from "../domain/ids";
import {
  createSourceAccount,
  creditKey,
  recordSyncFailure,
  recordSyncSuccess,
  type SourceAccount,
  type SourceConnectionStatus,
} from "../domain/source-account";
import type {
  CreateSourceAccountOutcome,
  NewSourceAccountCommand,
  SourceAccountRepository,
  SyncOutcome,
} from "../domain/source-account-repository";

/**
 * The shared state, separate from the repository, so one store can back
 * several repository instances in a test the way one database backs several
 * requests. Mirrors `InMemoryPaymentRequestStore`.
 */
export class InMemorySourceAccountStore {
  readonly accounts = new Map<SourceAccountId, SourceAccount>();
}

function identityKey(panelUrl: string, panelUsername: string): string {
  // Mirrors `source_account_identity_uniq`: (panel url, lower(username)), live
  // rows only. If these two ever disagree the fake passes and the INSERT
  // throws, so they are written to be read side by side.
  return `${panelUrl.trim()}::${panelUsername.trim().toLowerCase()}`;
}

export class InMemorySourceAccountRepository implements SourceAccountRepository {
  constructor(private readonly store: InMemorySourceAccountStore) {}

  private live(): SourceAccount[] {
    return [...this.store.accounts.values()].filter((a) => a.archivedAt === null);
  }

  async create(command: NewSourceAccountCommand): Promise<CreateSourceAccountOutcome> {
    const key = identityKey(command.panelUrl, command.panelUsername);
    const clash = this.live().find(
      (a) => identityKey(a.panelUrl, a.panelUsername) === key,
    );
    if (clash) {
      return { ok: false, reason: "identity-taken", conflictingAccountId: clash.id };
    }

    const account = createSourceAccount(command);
    this.store.accounts.set(account.id, account);
    return { ok: true, account };
  }

  async list(): Promise<readonly SourceAccount[]> {
    return this.live().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async get(id: SourceAccountId): Promise<SourceAccount | null> {
    return this.store.accounts.get(id) ?? null;
  }

  async recordSync(
    id: SourceAccountId,
    outcome: SyncOutcome,
    at: Date = new Date(),
  ): Promise<SourceAccount | null> {
    const account = this.store.accounts.get(id);
    if (!account) return null;

    if (outcome.ok) {
      // Deduplicated the way `source_account_credit_bucket_uniq` would: a
      // scrape that read the same bucket twice must not produce two rows here
      // and one INSERT failure against Postgres.
      const byBucket = new Map(
        outcome.credits.map((balance) => [creditKey(balance.plan, balance.period), balance]),
      );
      const updated = recordSyncSuccess(account, at, [...byBucket.values()]);
      this.store.accounts.set(id, updated);
      return updated;
    }

    const updated = recordSyncFailure(account, outcome.reason, at, outcome.detail ?? null);
    this.store.accounts.set(id, updated);
    return updated;
  }

  async archive(id: SourceAccountId, at: Date = new Date()): Promise<SourceAccount | null> {
    const account = this.store.accounts.get(id);
    if (!account) return null;

    const updated = Object.freeze({ ...account, archivedAt: at });
    this.store.accounts.set(id, updated);
    return updated;
  }

  async countByConnectionStatus(): Promise<ReadonlyMap<SourceConnectionStatus, number>> {
    const counts = new Map<SourceConnectionStatus, number>();
    for (const account of this.live()) {
      counts.set(account.connectionStatus, (counts.get(account.connectionStatus) ?? 0) + 1);
    }
    return counts;
  }
}
