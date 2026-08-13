import "server-only";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import type { ScopedUsersRepository } from "@/modules/identity/domain/scoped-users-repository";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import type { OrderingRepository } from "@/modules/ordering/domain/ordering-repository";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import type { PaymentRequestRepository } from "@/modules/wallet/domain/payment-request-repository";
import { DrizzlePaymentRequestRepository } from "@/modules/wallet/infrastructure/drizzle-payment-request-repository";
import { getDb } from "@/shared/db/client";

/**
 * Financials reads TWO sources, and deliberately does not merge them in the
 * database (backlog A6).
 *
 * An approved top-up is not a `sales_order`: that table requires a `plan_id`
 * and a `plan_price_id`, because an order is a purchase of something from the
 * catalogue. A top-up buys nothing — it is money entering the platform. Forcing
 * one into the other would mean inventing a phantom plan and defeating
 * `sales_order_funding_check`, so the two stay separate rows in two tables and
 * are merged HERE, in the view layer, where "everything that moved money" is
 * a presentation concern rather than a domain claim.
 */

export type AdminOrdersDeps = Readonly<{
  ordering: OrderingRepository;
  paymentRequests: PaymentRequestRepository;
  users: ScopedUsersRepository;
}>;

export async function adminOrdersDeps(): Promise<AdminOrdersDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  const db = getDb();
  return {
    ordering: new DrizzleOrderingRepository(db, scope),
    paymentRequests: new DrizzlePaymentRequestRepository(db, scope),
    users: new DrizzleScopedUsersRepository(db, scope),
  };
}
