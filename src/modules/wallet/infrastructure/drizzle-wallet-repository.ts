import { desc, eq, sql } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";
import { tenantWhere } from "@/shared/db/tenant";

import type { AccessScope } from "@/modules/identity/domain/access-scope";
import type { ResellerId } from "../domain/ids";
import type { WalletRepository } from "../domain/wallet-repository";
import {
  createWalletEntry,
  type NewWalletEntryInput,
  type WalletEntry,
  type WalletEntryKind,
} from "../domain/wallet-entry";
import { walletEntry } from "./wallet.schema";

function toWalletEntry(row: typeof walletEntry.$inferSelect): WalletEntry {
  return Object.freeze({ ...row, kind: row.kind as WalletEntryKind });
}

/**
 * Drizzle-backed wallet ledger, scoped at construction.
 *
 * Every read path forces `tenantWhere(walletEntry, scope)`: an ADMIN scope
 * sees every reseller's movements, a RESELLER scope only its own. The table
 * carries `reseller_id`, which is exactly what makes it passable to
 * `tenantWhere` — a table without that column is a compile error there, so
 * forgetting to scope this is not expressible.
 */
export class DrizzleWalletRepository implements WalletRepository {
  constructor(
    private readonly db: ModuleDb,
    private readonly scope: AccessScope,
  ) {}

  async append(input: NewWalletEntryInput): Promise<WalletEntry> {
    // The domain builds (and validates) the row; the adapter only stores it.
    const entry = createWalletEntry(input);
    await this.db.insert(walletEntry).values(entry);
    return entry;
  }

  async listEntries(resellerId: ResellerId): Promise<readonly WalletEntry[]> {
    const rows = await this.db
      .select()
      .from(walletEntry)
      .where(
        // Both predicates, always: the scope decides what this caller MAY
        // read, the argument decides what it ASKED for. A RESELLER scope
        // passing someone else's id matches nothing rather than leaking.
        this.scope.kind === "admin"
          ? eq(walletEntry.resellerId, resellerId)
          : sql`${eq(walletEntry.resellerId, resellerId)} AND ${tenantWhere(walletEntry, this.scope)}`,
      )
      .orderBy(desc(walletEntry.createdAt));

    return rows.map(toWalletEntry);
  }

  async balancesByReseller(): Promise<ReadonlyMap<ResellerId, number>> {
    const rows = await this.db
      .select({
        resellerId: walletEntry.resellerId,
        // `::bigint` sums to a string under `pg` (int8 does not fit a JS
        // number), so the cast to a plain integer is what keeps this a
        // number — the same trap `mode: 'number'` handles on the column.
        balance: sql<number>`sum(${walletEntry.amountMinor})::int`,
      })
      .from(walletEntry)
      .where(tenantWhere(walletEntry, this.scope))
      .groupBy(walletEntry.resellerId);

    return new Map(rows.map((row) => [row.resellerId, Number(row.balance)]));
  }
}
