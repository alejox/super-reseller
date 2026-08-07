"use server";

import { refresh } from "next/cache";

import { createProviderAccountForCustomer } from "@/modules/provider-accounts/application/admin/create-provider-account-for-customer";
import { DrizzleProviderAccountRepository } from "@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { getDb } from "@/shared/db/client";

export type CreateProviderAccountForCustomerFormState = { readonly error: string } | undefined;

const ERRORS = {
  "target-required": "Falta el cliente objetivo.",
  "service-required": "Seleccione un servicio.",
  "panel-username-required": "Ingrese el usuario real de esa cuenta.",
} as const;

/**
 * PA: ADMIN May Create A Provider Account On A Customer's Behalf (support
 * use case). `createProviderAccountForCustomer` (application/admin) itself
 * calls `requireRole("ADMIN")` and `actAsCustomer(targetUserId)` — the DB
 * re-verifies the target is a real, active `CUSTOMER` before anything is
 * written, so this action stays a thin shim over it.
 */
export async function createProviderAccountForCustomerAction(
  _state: CreateProviderAccountForCustomerFormState,
  formData: FormData,
): Promise<CreateProviderAccountForCustomerFormState> {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const panelUsername = String(formData.get("panelUsername") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();

  if (targetUserId === "") {
    return { error: ERRORS["target-required"] };
  }
  if (serviceId === "") {
    return { error: ERRORS["service-required"] };
  }
  if (panelUsername === "") {
    return { error: ERRORS["panel-username-required"] };
  }

  // The write itself scopes through the customer scope `actAsCustomer`
  // mints inside `createProviderAccountForCustomer`; this scope is only
  // used to construct the adapter's `.create()` method, which does not
  // read it (tenant id comes from the resolved target, never from here).
  await requireRole("ADMIN");
  const scope = await getScope();
  const deps = { providerAccounts: new DrizzleProviderAccountRepository(getDb(), scope) };

  await createProviderAccountForCustomer(deps, targetUserId, {
    serviceId,
    panelUsername,
    label: label === "" ? null : label,
  });

  refresh();
  return undefined;
}
