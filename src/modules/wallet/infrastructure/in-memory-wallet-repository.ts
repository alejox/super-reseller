import type { AccessScope } from "@/modules/identity/domain/access-scope";

import type { ResellerId } from "../domain/ids";
import type { WalletRepository } from "../domain/wallet-repository";
import { createWalletEntry, type NewWalletEntryInput, type WalletEntry } from "../domain/wallet-entry";

/**
 * The rows, independent of who is reading them.
 *
 * Separate from the repository for the same reason the Drizzle adapter is
 * separate from the database: two scopes must be able to read ONE ledger.
 * A fake that kept its rows inside the scoped object could never show that
 * a RESELLER scope fails to see another reseller's movements — it would
 * simply have none to miss, and the isolation test would pass for the wrong
 * reason.
 */
export class InMemoryWalletStore {
  readonly entries: WalletEntry[] = [];
}

/**
 * Test double for `WalletRepository` (design.md "Testing Strategy": "the
 * fake proves the use case is scoped, PGlite proves the SQL is"). Mirrors
 * `tenantWhere(walletEntry, scope)` exactly: ADMIN scope → every reseller,
 * RESELLER scope → only its own rows.
 */
export class InMemoryWalletRepository implements WalletRepository {
  constructor(
    private readonly store: InMemoryWalletStore,
    private readonly scope: AccessScope,
  ) {}

  async append(input: NewWalletEntryInput): Promise<WalletEntry> {
    const entry = createWalletEntry(input);
    this.store.entries.push(entry);
    return entry;
  }

  async listEntries(resellerId: ResellerId): Promise<readonly WalletEntry[]> {
    const scope = this.scope;
    return this.store.entries
      .filter(
        (entry) =>
          entry.resellerId === resellerId &&
          (scope.kind === "admin" || entry.resellerId === scope.resellerId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async balancesByReseller(): Promise<ReadonlyMap<ResellerId, number>> {
    const scope = this.scope;
    const visible =
      scope.kind === "admin"
        ? this.store.entries
        : this.store.entries.filter((entry) => entry.resellerId === scope.resellerId);

    const balances = new Map<ResellerId, number>();
    for (const entry of visible) {
      balances.set(entry.resellerId, (balances.get(entry.resellerId) ?? 0) + entry.amountMinor);
    }
    return balances;
  }
}
