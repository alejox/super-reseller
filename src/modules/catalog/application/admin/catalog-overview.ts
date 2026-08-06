import type { Money } from "@/shared/money/money";
import { planPriceAmount } from "../../domain/plan-price";

import type { CatalogRepository } from "../../domain/catalog-repository";
import type { PriceTierId } from "../../domain/ids";
import type { Plan } from "../../domain/plan";
import type { PriceTier } from "../../domain/price-tier";
import type { Service } from "../../domain/service";

/**
 * The ADMIN catalog screen's read model: everything the page needs, in a
 * fixed order, fetched in one place.
 */

export type CatalogOverviewDeps = Readonly<{
  catalog: Pick<
    CatalogRepository,
    "listPriceTiers" | "listServices" | "listPlans" | "listCurrentPlanPrices"
  >;
}>;

/**
 * A plan and its current price at each tier.
 *
 * A tier with no current price is ABSENT from `prices`, never zero. Those are
 * opposite facts — no price blocks the sale, a zero price gives the plan away
 * — and collapsing them would make the screen lie about which plans a
 * reseller can actually see.
 */
export type PlanWithPrices = Readonly<{
  plan: Plan;
  prices: Readonly<Record<PriceTierId, Money>>;
}>;

export type ServicePlans = Readonly<{
  service: Service;
  plans: readonly PlanWithPrices[];
}>;

export type CatalogOverview = Readonly<{
  priceTiers: readonly PriceTier[];
  services: readonly Service[];
  plansByService: readonly ServicePlans[];
}>;

/**
 * `localeCompare` rather than `<`: service names are operator-supplied and
 * accented ("Disney+", "Fútbol"), and raw code-point ordering would file
 * every accented name after "Z".
 */
function byText(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export async function loadCatalogOverview(
  deps: CatalogOverviewDeps,
): Promise<CatalogOverview> {
  // Four independent reads issued together rather than awaited in sequence:
  // the whole matrix costs one round trip's latency, not four, and stays
  // four queries no matter how large the catalog grows.
  const [priceTiers, services, plans, currentPrices] = await Promise.all([
    deps.catalog.listPriceTiers(),
    deps.catalog.listServices(),
    deps.catalog.listPlans(),
    deps.catalog.listCurrentPlanPrices(),
  ]);

  // Indexed by plan so the join below is linear instead of a scan per plan.
  const pricesByPlanId = new Map<string, Record<PriceTierId, Money>>();
  for (const price of currentPrices) {
    const forPlan = pricesByPlanId.get(price.planId) ?? {};
    forPlan[price.priceTierId] = planPriceAmount(price);
    pricesByPlanId.set(price.planId, forPlan);
  }

  const sortedServices = [...services].sort((a, b) => byText(a.name, b.name));

  return {
    priceTiers: [...priceTiers].sort((a, b) => byText(a.code, b.code)),
    services: sortedServices,
    plansByService: sortedServices.map((service) => ({
      service,
      plans: plans
        .filter((plan) => plan.serviceId === service.id)
        // Duration is the axis an operator scans a price list by — 30, 60,
        // 90 — so it orders the rows; the kind breaks ties within a duration.
        .sort((a, b) => a.durationDays - b.durationDays || byText(a.kind, b.kind))
        .map((plan) => ({ plan, prices: pricesByPlanId.get(plan.id) ?? {} })),
    })),
  };
}
