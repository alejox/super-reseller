import type { OrderingRepository } from "../../ordering/domain/ordering-repository";
import type { InventoryRepository } from "../infrastructure/drizzle-inventory-repository";
import type { AdminCatalogRepository } from "../../catalog/domain/catalog-repository";
import type { SalesOrderId } from "../../ordering/domain/sales-order";

export type AutoDeliverOrderDeps = Readonly<{
  ordering: OrderingRepository;
  inventory: InventoryRepository;
  catalog: AdminCatalogRepository;
}>;

export type AutoDeliverOrderResult =
  | Readonly<{ ok: true; accountId: string }>
  | Readonly<{ ok: false; reason: "order-not-found" | "order-not-pending" | "no-stock-available" | "plan-not-found" }>;

/**
 * Attempts to automatically deliver a pending order by picking an available
 * inventory account and assigning it to the order's provider account / buyer.
 */
export async function autoDeliverOrder(
  deps: AutoDeliverOrderDeps,
  orderId: SalesOrderId
): Promise<AutoDeliverOrderResult> {
  // 1. Fetch the order
  const order = await deps.ordering.getOrder(orderId);
  if (!order) {
    return { ok: false, reason: "order-not-found" };
  }
  if (order.status !== "PENDING") {
    return { ok: false, reason: "order-not-pending" };
  }

  // 2. Fetch the plan to know the serviceId
  const plan = await deps.catalog.findPlanById(order.planId);
  if (!plan) {
    return { ok: false, reason: "plan-not-found" };
  }
  
  // 3. Find an available account in the reseller's stock for this service
  const availableAccount = await deps.inventory.findAvailableAccount(order.resellerId, plan.serviceId);
  if (!availableAccount) {
    return { ok: false, reason: "no-stock-available" };
  }

  // 4. Assign the stock
  // If it's a customer order, it has a providerAccountId
  await deps.inventory.assignAccount(
    availableAccount.id,
    order.placedBy,
    order.providerAccountId
  );

  // 5. Fulfill the order
  await deps.ordering.fulfilOrder(orderId, "Auto-delivered from stock");

  return { ok: true, accountId: availableAccount.id };
}
