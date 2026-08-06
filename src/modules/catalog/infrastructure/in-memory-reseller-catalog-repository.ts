import type {
  ResellerCatalogRepository,
  SellablePlan,
  SellablePlanListing,
} from "../domain/catalog-repository";
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

  async listSellablePlans(): Promise<readonly SellablePlanListing[]> {
    const [sellable, services] = await Promise.all([
      this.store.listSellablePlansForTier(this.priceTierId),
      this.store.listServices(),
    ]);
    // Mirrors the Drizzle adapter's INNER JOIN on `service`: every plan has a
    // service by NOT NULL foreign key, so a missing one is a corrupt store,
    // not a case to paper over with a default.
    return sellable.map((entry) => {
      const service = services.find((candidate) => candidate.id === entry.plan.serviceId);
      if (!service) {
        throw new Error(`Plan ${entry.plan.id} references unknown service ${entry.plan.serviceId}`);
      }
      return { ...entry, serviceName: service.name, serviceSlug: service.slug };
    });
  }

  async findSellablePlan(planId: PlanId): Promise<SellablePlan | null> {
    return this.store.findSellablePlan(planId, this.priceTierId);
  }
}
