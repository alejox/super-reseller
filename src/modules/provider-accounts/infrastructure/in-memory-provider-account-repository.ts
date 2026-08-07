import { tenantIdOf, type AccessScope } from "@/modules/identity/domain/access-scope";

import type { ProviderAccountId, TenantId } from "../domain/ids";
import type { ProviderAccountRepository } from "../domain/provider-account-repository";
import { createProviderAccount, type NewProviderAccountInput, type ProviderAccount } from "../domain/provider-account";

/**
 * The rows, independent of who is reading them — mirrors
 * `InMemoryWalletStore`: two scopes must be able to read ONE store, or an
 * isolation test could pass for the wrong reason (having nothing to miss,
 * rather than being filtered out).
 */
export class InMemoryProviderAccountStore {
  readonly accounts: ProviderAccount[] = [];
}

/**
 * Test double for `ProviderAccountRepository` (design.md "Testing
 * Strategy": "the fake proves the use case is scoped, PGlite proves the SQL
 * is"). Mirrors `provider_account_identity_uniq` exactly: the SAME
 * (tenant, service, lower(panel_username)) pair with `archivedAt IS NULL`
 * cannot be registered twice; a different provider, or a different
 * customer, is unaffected.
 */
export class InMemoryProviderAccountRepository implements ProviderAccountRepository {
  constructor(
    private readonly store: InMemoryProviderAccountStore,
    private readonly scope: AccessScope,
  ) {}

  async create(input: NewProviderAccountInput): Promise<ProviderAccount> {
    const account = createProviderAccount(input);

    const duplicate = this.store.accounts.find(
      (existing) =>
        existing.tenantId === account.tenantId &&
        existing.serviceId === account.serviceId &&
        existing.panelUsername.toLowerCase() === account.panelUsername.toLowerCase() &&
        existing.archivedAt === null,
    );
    if (duplicate) {
      throw new Error(
        `provider_account_identity_uniq: an active account already exists for tenant ${account.tenantId}, service ${account.serviceId}, panel username "${account.panelUsername}".`,
      );
    }

    this.store.accounts.push(account);
    return account;
  }

  async listForTenant(tenantId: TenantId): Promise<readonly ProviderAccount[]> {
    const scopeTenantId = tenantIdOf(this.scope);
    return this.store.accounts
      .filter(
        (account) =>
          account.tenantId === tenantId &&
          (scopeTenantId === null || account.tenantId === scopeTenantId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: ProviderAccountId): Promise<ProviderAccount | null> {
    const scopeTenantId = tenantIdOf(this.scope);
    const account = this.store.accounts.find(
      (candidate) =>
        candidate.id === id && (scopeTenantId === null || candidate.tenantId === scopeTenantId),
    );
    return account ?? null;
  }
}
