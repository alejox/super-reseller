import { and, eq, isNull } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";

import type { ResellerCatalogRepository, SellablePlan } from "../domain/catalog-repository";
import type { PlanId, PriceTierId } from "../domain/ids";
import type { PlanKind } from "../domain/plan";
import { planPriceAmount } from "../domain/plan-price";
import { plan as planTable, planPrice as planPriceTable } from "./catalog.schema";

/**
 * Runs unmodified against both `NeonHttpDatabase` (production) and
 * `PgliteDatabase` (tests) — same pattern as `DrizzleCatalogRepository`.
 */
type CatalogDb = ModuleDb;

function toSellablePlan(
  plan: typeof planTable.$inferSelect,
  price: typeof planPriceTable.$inferSelect,
): SellablePlan {
  return Object.freeze({
    plan: Object.freeze({ ...plan, kind: plan.kind as PlanKind }),
    price: planPriceAmount(price),
    planPriceId: price.id,
  });
}

/**
 * RESELLER catalog surface over Drizzle (tasks 4.8–4.9). The tier is read
 * from the scope at construction — never accepted as a parameter — and
 * EVERY read path forces the tier predicate on the `plan_price` join:
 * `price_tier_id = scope.priceTierId AND effective_to IS NULL`. An inner
 * join means a plan without a current price at the scope's tier yields no
 * row: a fallback to another tier's price is not representable (CAT:
 * Missing Tier Price Blocks Sale, reseller surface).
 */
export class DrizzleResellerCatalogRepository implements ResellerCatalogRepository {
  constructor(
    private readonly db: CatalogDb,
    private readonly priceTierId: PriceTierId,
  ) {}

  async listSellablePlans(): Promise<readonly SellablePlan[]> {
    return this.sellableRows();
  }

  async findSellablePlan(planId: PlanId): Promise<SellablePlan | null> {
    const [row] = await this.sellableRows(planId);
    return row ?? null;
  }

  private async sellableRows(planId?: PlanId): Promise<SellablePlan[]> {
    const rows = await this.db
      .select({ plan: planTable, price: planPriceTable })
      .from(planTable)
      .innerJoin(
        planPriceTable,
        and(
          eq(planPriceTable.planId, planTable.id),
          // The tenant predicate: tier from the scope, never a parameter.
          eq(planPriceTable.priceTierId, this.priceTierId),
          isNull(planPriceTable.effectiveTo),
        ),
      )
      .where(planId ? eq(planTable.id, planId) : undefined);

    return rows.map((row) => toSellablePlan(row.plan, row.price));
  }
}
