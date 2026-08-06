import type { ResellerId } from "./ids";
import type { NewWalletEntryInput, WalletEntry } from "./wallet-entry";

/**
 * The wallet ledger port.
 *
 * Append and read. There is deliberately no `update`, no `delete`, and no
 * `setBalance`: the ledger records things that happened, and a thing that
 * happened cannot stop having happened. A correction is `append` with the
 * opposite sign, which is why the port needs no other write.
 *
 * Scoped at construction like `ScopedUsersRepository`, never per call — the
 * reseller id is read from the `AccessScope`, so an unscoped ledger read is
 * not expressible.
 */
export interface WalletRepository {
  append(entry: NewWalletEntryInput): Promise<WalletEntry>;

  /** Movements for one reseller, newest first. */
  listEntries(resellerId: ResellerId): Promise<readonly WalletEntry[]>;

  /**
   * Current balance in minor units for every reseller that has movements,
   * keyed by reseller id. Resellers with no entries are ABSENT, not zero —
   * the caller knows the difference between "no movements" and "balanced to
   * nothing", and this keeps the admin listing one query instead of one per
   * reseller.
   */
  balancesByReseller(): Promise<ReadonlyMap<ResellerId, number>>;
}
