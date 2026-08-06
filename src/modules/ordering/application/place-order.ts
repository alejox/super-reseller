import type { OrderingRepository, PlaceOrderOutcome } from "../domain/ordering-repository";
import type { PlanId, ResellerId, UserId } from "../domain/sales-order";

/**
 * RESELLER use case: buy a plan.
 *
 * The price is NOT accepted from the caller. It is resolved from the
 * catalog, at the tier the caller's scope is bound to, immediately before
 * the purchase — a submitted price is a number the buyer chose, and a form
 * field is not a price list.
 */

export type PlaceOrderDeps = Readonly<{
  ordering: Pick<OrderingRepository, "placeOrder">;
  /**
   * Resolves the plan at the CALLER'S tier. Injected because pricing is
   * catalog's fact: eslint bars ordering from importing catalog's entity
   * types, and the repository this resolves through is already bound to the
   * scope's tier, so no tier is passed here either.
   */
  resolveSellablePlan: (
    planId: PlanId,
  ) => Promise<{ planPriceId: string; amountMinor: number; currency: string } | null>;
  resellerId: ResellerId;
  placedBy: UserId;
}>;

export type PlaceOrderResult =
  | Readonly<{ ok: true; orderId: string }>
  | Readonly<{
      ok: false;
      reason: "plan-required" | "plan-unavailable" | "insufficient-funds";
      balanceMinor?: number;
      priceMinor?: number;
    }>;

export async function placeOrderAsReseller(
  deps: PlaceOrderDeps,
  input: Readonly<{ planId: string }>,
): Promise<PlaceOrderResult> {
  const planId = input.planId.trim();
  if (planId === "") {
    return { ok: false, reason: "plan-required" };
  }

  // Resolving through the scoped catalog is also the authorization check: a
  // plan with no current price at this reseller's tier is not sellable to
  // them at all (CAT: Missing Tier Price Blocks Sale), and comes back null
  // rather than at some other tier's price.
  const sellable = await deps.resolveSellablePlan(planId);
  if (sellable === null) {
    return { ok: false, reason: "plan-unavailable" };
  }

  const outcome: PlaceOrderOutcome = await deps.ordering.placeOrder({
    resellerId: deps.resellerId,
    placedBy: deps.placedBy,
    planId,
    planPriceId: sellable.planPriceId,
    amountMinor: sellable.amountMinor,
    currency: sellable.currency,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      reason: "insufficient-funds",
      balanceMinor: outcome.balanceMinor,
      priceMinor: sellable.amountMinor,
    };
  }

  return { ok: true, orderId: outcome.order.id };
}
