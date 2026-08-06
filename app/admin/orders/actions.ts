"use server";

import { refresh } from "next/cache";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { getDb } from "@/shared/db/client";

export type FulfilFormState = { readonly error: string } | undefined;

/**
 * Marks an order delivered.
 *
 * ADMIN only — and enforced HERE, not by the scope. A reseller's own order
 * is inside its own scope, so tenancy alone would happily let a reseller
 * mark its purchase delivered. Fulfilment is the owner's assertion that they
 * handed the account over; only they can make it.
 */
export async function fulfilOrderAction(
  _state: FulfilFormState,
  formData: FormData,
): Promise<FulfilFormState> {
  await requireRole("ADMIN");
  const scope = await getScope();

  const note = String(formData.get("note") ?? "").trim();
  const fulfilled = await new DrizzleOrderingRepository(getDb(), scope).fulfilOrder(
    String(formData.get("orderId") ?? ""),
    note === "" ? null : note,
  );

  if (fulfilled === null) {
    // "Already delivered", "cancelled" and "not found" are the same answer to
    // an operator who clicked twice: there is nothing left to do.
    return { error: "Esa orden ya no está pendiente." };
  }

  refresh();
  return undefined;
}
