import { and, desc, eq, sql } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";
import { tenantWhere } from "@/shared/db/tenant";

import type { AccessScope } from "@/modules/identity/domain/access-scope";
import type { ProviderAccountId, TenantId } from "../domain/ids";
import type { ProviderAccountRepository } from "../domain/provider-account-repository";
import { createProviderAccount, type NewProviderAccountInput, type ProviderAccount } from "../domain/provider-account";
import { providerAccount } from "./provider-account.schema";

function toProviderAccount(row: typeof providerAccount.$inferSelect): ProviderAccount {
  return Object.freeze({
    id: row.id,
    tenantId: row.resellerId,
    serviceId: row.serviceId,
    panelUsername: row.panelUsername,
    label: row.label,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
  });
}

/**
 * Drizzle-backed provider-accounts adapter, scoped at construction. Every
 * read path forces `tenantWhere(providerAccount, scope)` — mirrors
 * `DrizzleWalletRepository`. Runs against the real
 * `provider_account_identity_uniq` partial unique index; no duplicate check
 * here re-implements what the schema already enforces.
 */
export class DrizzleProviderAccountRepository implements ProviderAccountRepository {
  constructor(
    private readonly db: ModuleDb,
    private readonly scope: AccessScope,
  ) {}

  async create(input: NewProviderAccountInput): Promise<ProviderAccount> {
    const account = createProviderAccount(input);
    await this.db.insert(providerAccount).values({
      id: account.id,
      resellerId: account.tenantId,
      serviceId: account.serviceId,
      panelUsername: account.panelUsername,
      label: account.label,
      createdBy: account.createdBy,
      createdAt: account.createdAt,
      archivedAt: account.archivedAt,
    });
    return account;
  }

  async listForTenant(tenantId: TenantId): Promise<readonly ProviderAccount[]> {
    const rows = await this.db
      .select()
      .from(providerAccount)
      .where(
        this.scope.kind === "admin"
          ? eq(providerAccount.resellerId, tenantId)
          : sql`${eq(providerAccount.resellerId, tenantId)} AND ${tenantWhere(providerAccount, this.scope)}`,
      )
      .orderBy(desc(providerAccount.createdAt));

    return rows.map(toProviderAccount);
  }

  async findById(id: ProviderAccountId): Promise<ProviderAccount | null> {
    const [row] = await this.db
      .select()
      .from(providerAccount)
      .where(
        this.scope.kind === "admin"
          ? eq(providerAccount.id, id)
          : and(eq(providerAccount.id, id), tenantWhere(providerAccount, this.scope)),
      );

    return row ? toProviderAccount(row) : null;
  }
}
