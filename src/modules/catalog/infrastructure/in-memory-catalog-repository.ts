import type {
  CatalogRepository,
  CreatePlanWithInitialPriceInput,
  NewPriceTierInput,
  PriceTier,
  SellablePlan,
  SetPlanPriceInput,
} from "../domain/catalog-repository";
import type { PlanId, PriceTierId, ServiceId } from "../domain/ids";
import { DuplicatePlanIdentityError, type NewPlanInput, type Plan, createPlan, retirePlan } from "../domain/plan";
import {
  closeOutPrice,
  createPlanPrice,
  isPlanSellableAtTier,
  planPriceAmount,
  resolveCurrentPriceForTier,
  type PlanPrice,
} from "../domain/plan-price";
import { createPriceTier } from "../domain/price-tier";
import { type NewServiceInput, type Service, createService, retireService } from "../domain/service";

/**
 * Test double implementing the exact same port the Drizzle adapter
 * implements (design.md "Testing Strategy": "the fake proves the use case
 * is scoped, PGlite proves the SQL is"). Mirrors every constraint the real
 * schema enforces at the SQL level — including `plan_identity_uniq` — so
 * the contract suite gets the same answer from both.
 */
export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly priceTiers = new Map<PriceTierId, PriceTier>();
  private readonly services = new Map<ServiceId, Service>();
  private readonly plans = new Map<PlanId, Plan>();
  private readonly prices: PlanPrice[] = [];

  async createPriceTier(input: NewPriceTierInput): Promise<PriceTier> {
    const tier = createPriceTier(input);
    this.priceTiers.set(tier.id, tier);
    return tier;
  }

  async listPriceTiers(): Promise<readonly PriceTier[]> {
    return [...this.priceTiers.values()];
  }

  async createService(input: NewServiceInput): Promise<Service> {
    const service = createService(input);
    this.services.set(service.id, service);
    return service;
  }

  async retireService(serviceId: ServiceId): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) return;
    this.services.set(serviceId, retireService(service));
  }

  async findServiceById(serviceId: ServiceId): Promise<Service | null> {
    return this.services.get(serviceId) ?? null;
  }

  async listServices(): Promise<readonly Service[]> {
    return [...this.services.values()];
  }

  async createPlan(input: NewPlanInput): Promise<Plan> {
    // Mirrors plan_identity_uniq (service_id, kind, duration_days) WHERE
    // retired_at IS NULL.
    const duplicate = [...this.plans.values()].find(
      (existing) =>
        existing.serviceId === input.serviceId &&
        existing.kind === input.kind &&
        existing.durationDays === input.durationDays &&
        existing.retiredAt === null,
    );
    if (duplicate) {
      throw new DuplicatePlanIdentityError(input.serviceId, input.kind, input.durationDays);
    }

    const plan = createPlan(input);
    this.plans.set(plan.id, plan);
    return plan;
  }

  async createPlanWithInitialPrice(input: CreatePlanWithInitialPriceInput): Promise<Plan> {
    if (!this.priceTiers.has(input.priceTierId)) {
      throw new Error(`Price tier ${input.priceTierId} does not exist.`);
    }
    const plan = createPlan(input);
    const initialPrice = createPlanPrice({ planId: plan.id, priceTierId: input.priceTierId, amountMinor: input.amountMinor, currency: input.currency });
    const duplicate = [...this.plans.values()].find(
      (existing) =>
        existing.serviceId === input.serviceId &&
        existing.kind === input.kind &&
        existing.durationDays === input.durationDays &&
        existing.retiredAt === null,
    );
    if (duplicate) {
      throw new DuplicatePlanIdentityError(input.serviceId, input.kind, input.durationDays);
    }

    this.plans.set(plan.id, plan);
    this.prices.push(initialPrice);
    return plan;
  }

  async retirePlan(planId: PlanId): Promise<void> {
    const plan = this.plans.get(planId);
    if (!plan) return;
    this.plans.set(planId, retirePlan(plan));
  }

  async findPlanById(planId: PlanId): Promise<Plan | null> {
    return this.plans.get(planId) ?? null;
  }

  async listPlansByService(serviceId: ServiceId): Promise<readonly Plan[]> {
    return [...this.plans.values()].filter((plan) => plan.serviceId === serviceId);
  }

  async setPlanPrice(input: SetPlanPriceInput): Promise<PlanPrice> {
    const priorIndex = this.prices.findIndex(
      (price) =>
        price.planId === input.planId &&
        price.priceTierId === input.priceTierId &&
        price.effectiveTo === null,
    );
    if (priorIndex !== -1) {
      const prior = this.prices[priorIndex];
      if (prior) {
        this.prices[priorIndex] = closeOutPrice(prior);
      }
    }

    const next = createPlanPrice(input);
    this.prices.push(next);
    return next;
  }

  async listPlanPriceHistory(planId: PlanId, tierId: PriceTierId): Promise<readonly PlanPrice[]> {
    return this.prices.filter((price) => price.planId === planId && price.priceTierId === tierId);
  }

  async listPlans(): Promise<readonly Plan[]> {
    return [...this.plans.values()];
  }

  async listCurrentPlanPrices(): Promise<readonly PlanPrice[]> {
    // Mirrors the Drizzle adapter's `WHERE effective_to IS NULL`, which the
    // `plan_price_current_uniq` index limits to one row per (plan, tier).
    return this.prices.filter((price) => price.effectiveTo === null);
  }

  async findSellablePlan(planId: PlanId, tierId: PriceTierId): Promise<SellablePlan | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const planPrices = this.prices.filter((price) => price.planId === planId);
    if (!isPlanSellableAtTier(planPrices, tierId)) return null;

    const current = resolveCurrentPriceForTier(planPrices, tierId);
    if (!current) return null;

    return { plan, price: planPriceAmount(current), planPriceId: current.id };
  }

  /**
   * Non-port helper for the reseller surface (4.8–4.9): every plan
   * sellable at exactly ONE tier, mirroring the Drizzle reseller adapter's
   * `plan ⋈ plan_price WHERE tier = ? AND effective_to IS NULL` join —
   * a plan without a current price at `tierId` yields no entry, so a
   * fallback to another tier's price is not representable.
   */
  async listSellablePlansForTier(tierId: PriceTierId): Promise<readonly SellablePlan[]> {
    return [...this.plans.values()].flatMap((plan) => {
      const planPrices = this.prices.filter((price) => price.planId === plan.id);
      if (!isPlanSellableAtTier(planPrices, tierId)) return [];

      const current = resolveCurrentPriceForTier(planPrices, tierId);
      if (!current) return [];

      return [{ plan, price: planPriceAmount(current), planPriceId: current.id }];
    });
  }
}
