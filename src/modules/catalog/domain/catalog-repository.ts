import type { Money } from "@/shared/money/money";

import type { PlanId, PlanPriceId, PriceTierId, ServiceId } from "./ids";
import type { NewPlanInput, Plan } from "./plan";
import type { NewPlanPriceInput, PlanPrice } from "./plan-price";
import type { NewPriceTierInput, PriceTier } from "./price-tier";
import type { NewServiceInput, Service } from "./service";

export type { NewPriceTierInput, PriceTier };

export type SetPlanPriceInput = Readonly<{
  planId: PlanId;
  priceTierId: PriceTierId;
  amountMinor: number;
  currency: NewPlanPriceInput["currency"];
}>;

/** A plan and its mandatory first price, persisted as one repository operation. */
export type CreatePlanWithInitialPriceInput = NewPlanInput &
  Readonly<{
    priceTierId: PriceTierId;
    amountMinor: number;
    currency: NewPlanPriceInput["currency"];
  }>;

/**
 * A plan resolved as sellable at one specific tier. `planPriceId` is the
 * order-time anchor (design.md: "plan_price is append-only and individually
 * addressable") — a future order line stores this id, not a copied amount.
 */
export type SellablePlan = Readonly<{
  plan: Plan;
  price: Money;
  planPriceId: PlanPriceId;
}>;

/**
 * Role-narrowed catalog repository surfaces (design.md "Decision:
 * AccessScope is an opaque branded token minted only by the DAL":
 * "admin-only capability is removed from the *type* under a reseller
 * scope"). `CatalogRepositoryFactory.for` (identity/infrastructure)
 * selects between them by scope kind: an ADMIN scope gets the full
 * unscoped surface, a RESELLER scope a sellable-only surface where the
 * tier is read from the scope and NEVER accepted as a parameter — "price
 * me at the cheapest tier" is not expressible.
 */

/** The ADMIN surface is the full unscoped port: every row, any tier. */
export type AdminCatalogRepository = CatalogRepository;

/**
 * The RESELLER surface: sellable plans only, tier-free. No admin
 * capability (create/retire/set price) is reachable through this type.
 */
export interface ResellerCatalogRepository {
  listSellablePlans(): Promise<readonly SellablePlan[]>;
  findSellablePlan(planId: PlanId): Promise<SellablePlan | null>;
}

/**
 * Unscoped catalog repository port for slice 3b. `AccessScope` (slice 4)
 * will wrap the reseller-facing surface so `priceTierId` is read from the
 * scope instead of accepted as a caller-supplied parameter — see design.md
 * "Decision: AccessScope is an opaque branded token minted only by the
 * DAL". Building that wrapper is explicitly out of scope here.
 */
export interface CatalogRepository {
  createPriceTier(input: NewPriceTierInput): Promise<PriceTier>;
  listPriceTiers(): Promise<readonly PriceTier[]>;

  createService(input: NewServiceInput): Promise<Service>;
  retireService(serviceId: ServiceId): Promise<void>;
  findServiceById(serviceId: ServiceId): Promise<Service | null>;
  listServices(): Promise<readonly Service[]>;

  createPlan(input: NewPlanInput): Promise<Plan>;
  createPlanWithInitialPrice(input: CreatePlanWithInitialPriceInput): Promise<Plan>;
  retirePlan(planId: PlanId): Promise<void>;
  findPlanById(planId: PlanId): Promise<Plan | null>;
  listPlansByService(serviceId: ServiceId): Promise<readonly Plan[]>;

  /** Append-only: closes out the current row for (planId, tierId), then inserts a new one. */
  setPlanPrice(input: SetPlanPriceInput): Promise<PlanPrice>;
  listPlanPriceHistory(planId: PlanId, tierId: PriceTierId): Promise<readonly PlanPrice[]>;

  /**
   * CAT: Missing Tier Price Blocks Sale. Returns `null` — never a price
   * from a different tier — when no current price row exists for
   * `tierId`.
   */
  findSellablePlan(planId: PlanId, tierId: PriceTierId): Promise<SellablePlan | null>;
}
