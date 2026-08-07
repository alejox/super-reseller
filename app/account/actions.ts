"use server";

import { refresh } from "next/cache";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import { createProviderAccount } from "@/modules/provider-accounts/application/create-provider-account";
import { accountDeps } from "./account-deps";

export type CreateProviderAccountFormState = { readonly error: string } | undefined;

const ERRORS = {
  "service-required": "Seleccione un servicio.",
  "panel-username-required": "Ingrese el usuario real de esa cuenta.",
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
