import type { ProviderAccountId, TenantId } from "./ids";
import type { NewProviderAccountInput, ProviderAccount } from "./provider-account";

/**
 * The provider-accounts port. Scoped at construction, like
 * `WalletRepository` and `ScopedUsersRepository`, never per call — an
 * unscoped read or write is not expressible.
 *
 * `listForTenant`/`findById` both take the requested tenant/id AND are
 * ANDed against the caller's own scope by the adapter (mirrors
 * `DrizzleWalletRepository#listEntries`): the argument decides what the
 * caller ASKED for, the scope decides what it MAY read. PA: Provider
 * Account Isolation — a customer scope never sees another customer's rows;
 * a reseller scope always sees none (`provider_account` carries no
 * reseller-owned rows at all).
 */
export interface ProviderAccountRepository {
  create(input: NewProviderAccountInput): Promise<ProviderAccount>;

  /** Accounts owned by `tenantId`, newest first — empty if out of scope. */
  listForTenant(tenantId: TenantId): Promise<readonly ProviderAccount[]>;

  /** A single account by id, or `null` if it does not exist or is out of scope. */
  findById(id: ProviderAccountId): Promise<ProviderAccount | null>;
}
