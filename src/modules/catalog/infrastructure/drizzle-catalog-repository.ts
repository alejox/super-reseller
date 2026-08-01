import { and, eq, isNull } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import type {
  CatalogRepository,
  NewPriceTierInput,
  PriceTier,
  SellablePlan,
  SetPlanPriceInput,
} from "../domain/catalog-repository";
import type { PlanId, PriceTierId, ServiceId } from "../domain/ids";
import { createPlan, type NewPlanInput, type Plan, type PlanKind } from "../domain/plan";
import { createPlanPrice, planPriceAmount, type PlanPrice } from "../domain/plan-price";
import { createPriceTier } from "../domain/price-tier";
import { createService, type NewServiceInput, type Service } from "../domain/service";
import {
  plan as planTable,
  planPrice as planPriceTable,
  priceTier as priceTierTable,
  service as serviceTable,
} from "./catalog.schema";

/**
 * This repository must run unmodified against both `NeonHttpDatabase`
 * (production) and `PgliteDatabase` (tests) — a concrete union of the two
 * driver-returned types, rather than `any` generics, mirrors the intent of
 * the `RollbackableDb` pattern already used in shared/db/migrator.ts for
 * the same reason without tripping `@typescript-eslint/no-explicit-any`.
 */
type CatalogDb = NeonHttpDatabase | PgliteDatabase;

function toService(row: typeof serviceTable.$inferSelect): Service {
  return Object.freeze({ ...row });
}

function toPlan(row: typeof planTable.$inferSelect): Plan {
  return Object.freeze({ ...row, kind: row.kind as PlanKind });
}

function toPlanPrice(row: typeof planPriceTable.$inferSelect): PlanPrice {
  return Object.freeze({ ...row });
}

/**
 * Drizzle-backed adapter (design.md "Testing Strategy": PGlite proves the
 * SQL). Runs against the real `plan_identity_uniq` / `plan_price_current_uniq`
 * constraints — no business rule here re-implements what the schema already
 * enforces.
 */
export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly db: CatalogDb) {}

  async createPriceTier(input: NewPriceTierInput): Promise<PriceTier> {
    const tier = createPriceTier(input);
    await this.db.insert(priceTierTable).values(tier);
    return tier;
  }

  async createService(input: NewServiceInput): Promise<Service> {
    const service = createService(input);
    await this.db.insert(serviceTable).values(service);
    return service;
  }

  async retireService(serviceId: ServiceId): Promise<void> {
    const now = new Date();
    await this.db
      .update(serviceTable)
      .set({ retiredAt: now, updatedAt: now })
      .where(eq(serviceTable.id, serviceId));
  }

  async findServiceById(serviceId: ServiceId): Promise<Service | null> {
    const [row] = await this.db.select().from(serviceTable).where(eq(serviceTable.id, serviceId));
    return row ? toService(row) : null;
  }

  async createPlan(input: NewPlanInput): Promise<Plan> {
    const plan = createPlan(input);
    // plan_identity_uniq (partial unique index) rejects a duplicate active
    // identity at the SQL level — no duplicate check here, the DB is the
    // single source of truth for this invariant.
    await this.db.insert(planTable).values(plan);
    return plan;
  }

  async findPlanById(planId: PlanId): Promise<Plan | null> {
    const [row] = await this.db.select().from(planTable).where(eq(planTable.id, planId));
    return row ? toPlan(row) : null;
  }

  async listPlansByService(serviceId: ServiceId): Promise<readonly Plan[]> {
    const rows = await this.db.select().from(planTable).where(eq(planTable.serviceId, serviceId));
    return rows.map(toPlan);
  }

  async setPlanPrice(input: SetPlanPriceInput): Promise<PlanPrice> {
    // NOT wrapped in db.transaction(): the Neon HTTP driver has no
    // transaction support at all (drizzle-orm's NeonHttpSession#transaction
    // throws "No transactions support in neon-http driver" — the same
    // driver constraint design.md already accepted for rejecting Postgres
    // RLS via SET LOCAL). Two sequential statements instead: close out the
    // current row, then insert the new one. A crash between the two leaves
    // the (plan, tier) with zero current rows, never two — it fails safely
    // toward "not sellable", and plan_price_current_uniq still guarantees
    // at most one current row exists at any point.
    await this.db
      .update(planPriceTable)
      .set({ effectiveTo: new Date() })
      .where(
        and(
          eq(planPriceTable.planId, input.planId),
          eq(planPriceTable.priceTierId, input.priceTierId),
          isNull(planPriceTable.effectiveTo),
        ),
      );

    const next = createPlanPrice(input);
    await this.db.insert(planPriceTable).values(next);
    return next;
  }

  async listPlanPriceHistory(planId: PlanId, tierId: PriceTierId): Promise<readonly PlanPrice[]> {
    const rows = await this.db
      .select()
      .from(planPriceTable)
      .where(and(eq(planPriceTable.planId, planId), eq(planPriceTable.priceTierId, tierId)));
    return rows.map(toPlanPrice);
  }

  async findSellablePlan(planId: PlanId, tierId: PriceTierId): Promise<SellablePlan | null> {
    // Inner join, exact tier only — a missing current row for this tier
    // yields no row at all, so a fallback to another tier's price is not
    // representable in this query (CAT: Missing Tier Price Blocks Sale).
    const rows = await this.db
      .select({ plan: planTable, price: planPriceTable })
      .from(planTable)
      .innerJoin(
        planPriceTable,
        and(
          eq(planPriceTable.planId, planTable.id),
          eq(planPriceTable.priceTierId, tierId),
          isNull(planPriceTable.effectiveTo),
        ),
      )
      .where(eq(planTable.id, planId));

    const [row] = rows;
    if (!row) return null;

    const price = toPlanPrice(row.price);
    return { plan: toPlan(row.plan), price: planPriceAmount(price), planPriceId: price.id };
  }
}
