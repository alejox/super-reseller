import type { CatalogRepository } from "../../domain/catalog-repository";
import type { PlanPrice } from "../../domain/plan-price";
import { CATALOG_CURRENCY, parseAmountMinor } from "./catalog-amounts";

/**
 * ADMIN use case: set a plan's price at one tier.
 *
 * This is the single control that decides whether a plan is sellable to a
 * given tier at all. The repository call is append-only: it closes out the
 * current row and inserts a new one, so an order sold at the old amount keeps
 * pointing at the row it was sold under (CAT: Price History Is Preserved).
 */

export type SetPlanPriceDeps = Readonly<{
  catalog: Pick<CatalogRepository, "setPlanPrice" | "findPlanById" | "listPriceTiers">;
}>;

export type SetPlanPriceResult =
  | Readonly<{ ok: true; price: PlanPrice }>
  | Readonly<{ ok: false; reason: "plan-unknown" | "tier-unknown" | "amount-invalid" }>;

export type SetPlanPriceInputFields = Readonly<{
  planId: string;
  priceTierId: string;
  amountMinor: string;
}>;

export async function setPlanPriceAsAdmin(
  deps: SetPlanPriceDeps,
  input: SetPlanPriceInputFields,
): Promise<SetPlanPriceResult> {
  const amountMinor = parseAmountMinor(input.amountMinor);
  if (amountMinor === null) {
    return { ok: false, reason: "amount-invalid" };
  }

  if ((await deps.catalog.findPlanById(input.planId)) === null) {
    return { ok: false, reason: "plan-unknown" };
  }
  const tiers = await deps.catalog.listPriceTiers();
  if (!tiers.some((tier) => tier.id === input.priceTierId)) {
    return { ok: false, reason: "tier-unknown" };
  }

  const price = await deps.catalog.setPlanPrice({
    planId: input.planId,
    priceTierId: input.priceTierId,
    amountMinor,
    currency: CATALOG_CURRENCY,
  });

  return { ok: true, price };
}
