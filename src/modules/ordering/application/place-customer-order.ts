import type { OrderingRepository } from "../domain/ordering-repository";
import type { PlanId, ProviderAccountId, ResellerId, UserId } from "../domain/sales-order";

/**
 * CUSTOMER use case: buy a plan for a `provider_account`.
 *
 * Mirrors `place-order.ts`'s shape. The price is NOT accepted from the
 * caller — there is no price field anywhere in `PlaceCustomerOrderInput` —
 * it is resolved from the catalog, at the tier the caller's scope is bound
 * to, immediately before the purchase (CP: Price Resolves From The Catalog
 * At Purchase Time).
 */

export type PlaceCustomerOrderDeps = Readonly<{
  ordering: Pick<OrderingRepository, "placeCustomerOrder">;
  /**
   * Resolves the plan at the CALLER'S tier — same injection reason as
   * `place-order.ts`'s `resolveSellablePlan`: eslint bars ordering from
   * importing catalog's entity types.
   */
  resolveSellablePlan: (planId: PlanId) => Promise<{ planPriceId: string } | null>;
  /**
   * Resolves the `provider_account` the caller OWNS, or `null` when it does
   * not exist or belongs to someone else (CP: A Customer Starts Their Own
   * Purchase). Injected as a scoped lookup — the composition root supplies
   * `providerAccounts.findById(id)` on a repository already scoped to the
   * caller's own tenant, so "own" and "exists" collapse into one answer,
   * the same way `resolveSellablePlan` already does for the tier.
   */
  findOwnProviderAccount: (
    providerAccountId: ProviderAccountId,
  ) => Promise<{ id: ProviderAccountId } | null>;
  /** The customer's own tenant id, or the target customer's on a support purchase. */
  resellerId: ResellerId;
  /** `actingAdminUserId ?? userId`. */
  placedBy: UserId;
}>;

export type PlaceCustomerOrderResult =
  | Readonly<{ ok: true; orderId: string }>
  | Readonly<{
      ok: false;
      reason: "plan-required" | "plan-unavailable" | "provider-account-required" | "provider-account-not-owned";
    }>;

export async function placeOrderAsCustomer(
  deps: PlaceCustomerOrderDeps,
  input: Readonly<{ planId: string; providerAccountId: string }>,
): Promise<PlaceCustomerOrderResult> {
  const planId = input.planId.trim();
  if (planId === "") {
    return { ok: false, reason: "plan-required" };
  }

  const providerAccountId = input.providerAccountId.trim();
  if (providerAccountId === "") {
    return { ok: false, reason: "provider-account-required" };
  }

  // Ownership first: naming an account the caller does not own is refused
  // before any catalog work happens, the same "resolving through scope IS
  // the authorization check" shape `place-order.ts` uses for the tier.
  const account = await deps.findOwnProviderAccount(providerAccountId);
  if (account === null) {
    return { ok: false, reason: "provider-account-not-owned" };
  }

  const sellable = await deps.resolveSellablePlan(planId);
  if (sellable === null) {
    return { ok: false, reason: "plan-unavailable" };
  }

  const order = await deps.ordering.placeCustomerOrder({
    resellerId: deps.resellerId,
    placedBy: deps.placedBy,
    planId,
    planPriceId: sellable.planPriceId,
    providerAccountId,
  });

  return { ok: true, orderId: order.id };
}
