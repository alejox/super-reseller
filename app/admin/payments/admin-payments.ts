import "server-only";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import type { ScopedUsersRepository } from "@/modules/identity/domain/scoped-users-repository";
import { DrizzleScopedUsersRepository } from "@/modules/identity/infrastructure/drizzle-users-repository";
import type { PaymentRequestRepository } from "@/modules/wallet/domain/payment-request-repository";
import { DrizzlePaymentRequestRepository } from "@/modules/wallet/infrastructure/drizzle-payment-request-repository";
import { getDb } from "@/shared/db/client";

/**
 * The payment-validation screen's composition root.
 *
 * `users` is here for one reason: a claim carries a `reseller_id`, and an
 * operator deciding whether money arrived needs to see WHOSE account it is.
 * Resolving that is identity's job, and `app/` is the only layer allowed to
 * hold both modules at once.
 */

export type AdminPaymentsDeps = Readonly<{
  paymentRequests: PaymentRequestRepository;
  users: ScopedUsersRepository;
  /** The reviewer. Backlog A10: every decision is signed. */
  actorId: string;
}>;

export async function adminPaymentsDeps(): Promise<AdminPaymentsDeps> {
  await requireRole("ADMIN");
  const scope = await getScope();

  if (scope.kind !== "admin") {
    // Unreachable after `requireRole("ADMIN")`: the scope is built from the
    // same DB-verified session row the role came from. Throwing beats a cast.
    throw new Error("An ADMIN session did not produce an admin scope.");
  }

  const db = getDb();
  return {
    paymentRequests: new DrizzlePaymentRequestRepository(db, scope),
    users: new DrizzleScopedUsersRepository(db, scope),
    actorId: scope.userId,
  };
}
