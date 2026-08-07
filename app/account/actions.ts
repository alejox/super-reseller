"use server";

import { refresh } from "next/cache";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { createProviderAccount } from "@/modules/provider-accounts/application/create-provider-account";
import { DrizzleProviderAccountRepository } from "@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository";
import { placeOrderAsCustomer } from "@/modules/ordering/application/place-customer-order";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { getDb } from "@/shared/db/client";
import { accountDeps } from "./account-deps";

export type CreateProviderAccountFormState = { readonly error: string } | undefined;
export type PurchaseFormState = { readonly error: string } | undefined;

const ERRORS = {
  "service-required": "Seleccione un servicio.",
  "panel-username-required": "Ingrese el usuario real de esa cuenta.",
  forbidden: "No tiene permiso para esta operación.",
} as const;

const PURCHASE_ERRORS = {
  "plan-required": "Seleccione una duración.",
  "plan-unavailable": "Esa duración ya no está disponible para su lista de precios.",
  "provider-account-required": "Seleccione una cuenta.",
  "provider-account-not-owned": "Esa cuenta no le pertenece.",
  forbidden: "No tiene permiso para esta operación.",
} as const;

/**
 * PA: A Customer Creates Their Own Provider Account — self-service path.
 * `requireRole("CUSTOMER")` + `getScope()` re-verify the caller; the tenant
 * id is read from the scope and never accepted from the form, so "create an
 * account for someone else" is not expressible from this action's inputs.
 */
export async function createProviderAccountAction(
  _state: CreateProviderAccountFormState,
  formData: FormData,
): Promise<CreateProviderAccountFormState> {
  await requireRole("CUSTOMER");
  const scope = await getScope();

  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const panelUsername = String(formData.get("panelUsername") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();

  if (serviceId === "") {
    return { error: ERRORS["service-required"] };
  }
  if (panelUsername === "") {
    return { error: ERRORS["panel-username-required"] };
  }

  if (scope.kind !== "customer") {
    return { error: ERRORS.forbidden };
  }

  const deps = await accountDeps();
  await createProviderAccount(deps, scope, scope.tenantId, {
    serviceId,
    panelUsername,
    label: label === "" ? null : label,
  });

  refresh();
  return undefined;
}

/**
 * CP: A Customer Starts Their Own Purchase — self-service path. Mirrors
 * `app/panel/actions.ts`'s `buyPlanAction`: the price is never a field on
 * this form. It is resolved server-side from the plan id, at the tier the
 * caller's own scope is bound to (CP: Price Resolves From The Catalog At
 * Purchase Time), and the provider account must belong to the caller
 * (CP: A Customer Starts Their Own Purchase) — both checks happen inside
 * `placeOrderAsCustomer`, not here.
 */
export async function purchaseAction(
  _state: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  await requireRole("CUSTOMER");
  const scope = await getScope();

  if (scope.kind !== "customer") {
    // Narrowed before use: unreachable after `requireRole("CUSTOMER")`.
    return { error: ERRORS.forbidden };
  }

  const db = getDb();
  const catalog = createDrizzleScopedCatalogRepositoryFactory(db).for(scope);
  const providerAccounts = new DrizzleProviderAccountRepository(db, scope);

  const result = await placeOrderAsCustomer(
    {
      ordering: new DrizzleOrderingRepository(db, scope),
      resolveSellablePlan: async (planId) => {
        const sellable = await catalog.findSellablePlan(planId);
        return sellable === null ? null : { planPriceId: sellable.planPriceId };
      },
      findOwnProviderAccount: (providerAccountId) => providerAccounts.findById(providerAccountId),
      resellerId: scope.tenantId,
      placedBy: scope.actingAdminUserId ?? scope.userId,
    },
    {
      planId: String(formData.get("planId") ?? ""),
      providerAccountId: String(formData.get("providerAccountId") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: PURCHASE_ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}
