import type { ResellerCatalogRepository, SellablePlan } from "../domain/catalog-repository";
import type { PlanId, PriceTierId } from "../domain/ids";
import { InMemoryCatalogRepository } from "./in-memory-catalog-repository";

/**
 * RESELLER surface over the in-memory store (design.md: "the tier is read
 * from the scope and never accepted as a parameter"). Bound to exactly one
 * tier at construction by `ScopedRepositoryFactory` — the caller never
 * passes a tier, so "price me at the cheapest tier" is not expressible and
 * another tier's prices are unreachable.
 */
export class InMemoryResellerCatalogRepository implements ResellerCatalogRepository {
  constructor(
    private readonly store: InMemoryCatalogRepository,
    private readonly priceTierId: PriceTierId,
  ) {}

  async listSellablePlans(): Promise<readonly SellablePlan[]> {
    return this.store.listSellablePlansForTier(this.priceTierId);
  }

  async findSellablePlan(planId: PlanId): Promise<SellablePlan | null> {
    return this.store.findSellablePlan(planId, this.priceTierId);
  }
}
