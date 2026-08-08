"use server";

import { refresh } from "next/cache";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { getDb } from "@/shared/db/client";
import { DrizzleInventoryRepository } from "@/modules/inventory/infrastructure/drizzle-inventory-repository";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import type { AdminCatalogRepository } from "@/modules/catalog/domain/catalog-repository";
import { autoDeliverOrder } from "@/modules/inventory/application/auto-deliver-order";

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

export type AutoDeliverFormState = { readonly error?: string; readonly success?: boolean; readonly accountId?: string } | undefined;

export async function autoDeliverOrderAction(
  _state: AutoDeliverFormState,
  formData: FormData,
): Promise<AutoDeliverFormState> {
  await requireRole("ADMIN");
  const scope = await getScope();
  const db = getDb();

  const ordering = new DrizzleOrderingRepository(db, scope);
  const inventory = new DrizzleInventoryRepository(db);
  const catalog = createDrizzleScopedCatalogRepositoryFactory(db).for(scope) as AdminCatalogRepository;

  const result = await autoDeliverOrder(
    { ordering, inventory, catalog },
    String(formData.get("orderId") ?? "")
  );

  if (!result.ok) {
    if (result.reason === "no-stock-available") {
      return { error: "No hay cuentas disponibles en stock." };
    }
    return { error: "No se pudo auto-entregar la orden." };
  }

  refresh();
  return { success: true, accountId: result.accountId };
}
