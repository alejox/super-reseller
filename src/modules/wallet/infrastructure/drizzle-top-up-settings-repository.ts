import type { ModuleDb } from "@/shared/db/module-db";

import type { UserId } from "../domain/ids";
import { createTopUpLimits, DEFAULT_TOP_UP_LIMITS, type TopUpLimits } from "../domain/top-up-limits";
import type { TopUpSettingsRepository } from "../domain/top-up-settings-repository";
import { topUpSettings } from "./wallet.schema";

/**
 * Drizzle-backed top-up limits.
 *
 * NOT scoped by `tenantWhere`, and it cannot be: the table has no
 * `reseller_id`, because there is exactly one row for the whole platform. The
 * guard is therefore the composition root — every caller reaches this through
 * a deps factory that has already run `requireRole("ADMIN")`. That is a
 * deliberate difference from the rest of the module, where scoping is
 * structural, so it is written down here rather than left to be noticed.
 */
export class DrizzleTopUpSettingsRepository implements TopUpSettingsRepository {
  constructor(private readonly db: ModuleDb) {}

  async read(): Promise<TopUpLimits> {
    const [row] = await this.db.select().from(topUpSettings).limit(1);

    // No row means nobody has configured this yet, which is not an absent
    // value — it is the defaults. Returning null here would put a "what if
    // it's missing" branch in every caller, and the one that forgot it would
    // be a top-up screen with no limits at all.
    if (!row) return DEFAULT_TOP_UP_LIMITS;

    return createTopUpLimits(
      {
        minAmountMinor: Number(row.minAmountMinor),
        maxAmountMinor: Number(row.maxAmountMinor),
        currency: row.currency,
      },
      row.updatedBy,
      row.updatedAt,
    );
  }

  async save(limits: TopUpLimits, updatedBy: UserId): Promise<TopUpLimits> {
    const updatedAt = new Date();

    const [row] = await this.db
      .insert(topUpSettings)
      .values({
        id: true,
        minAmountMinor: limits.minAmountMinor,
        maxAmountMinor: limits.maxAmountMinor,
        currency: limits.currency,
        updatedBy,
        updatedAt,
      })
      // Upsert on the singleton key: the first save creates the row, every
      // later one replaces it. A read-then-insert would race two admins into
      // a duplicate-key error on a screen where nothing is actually wrong.
      .onConflictDoUpdate({
        target: topUpSettings.id,
        set: {
          minAmountMinor: limits.minAmountMinor,
          maxAmountMinor: limits.maxAmountMinor,
          currency: limits.currency,
          updatedBy,
          updatedAt,
        },
      })
      .returning();

    return createTopUpLimits(
      {
        minAmountMinor: Number(row.minAmountMinor),
        maxAmountMinor: Number(row.maxAmountMinor),
        currency: row.currency,
      },
      row.updatedBy,
      row.updatedAt,
    );
  }
}
