"use server";

import { refresh } from "next/cache";

import {
  archiveSourceAccount,
  registerSourceAccount,
} from "@/modules/source-accounts/application/admin/manage-source-accounts";

import { adminSourceAccountsDeps } from "./admin-source-accounts";

/**
 * Registering and retiring a supplier panel login.
 *
 * There is no "sync now" action here, and that is not an oversight: no
 * automation exists in this repository yet. The seam it will report through is
 * `recordSyncAttempt`, already written and tested — a button that pretended to
 * connect would be the mock data block G is trying to remove.
 */

export type SourceAccountFormState = { readonly error: string } | undefined;

const ERRORS = {
  "panel-url-required": "Escriba la dirección del panel del proveedor.",
  "panel-username-required": "Escriba el usuario con el que se ingresa al panel del proveedor.",
  "identity-taken": "Ese usuario ya está registrado para ese panel.",
  "not-found": "Esa cuenta ya no existe.",
} as const;

export async function registerSourceAccountAction(
  _state: SourceAccountFormState,
  formData: FormData,
): Promise<SourceAccountFormState> {
  const deps = await adminSourceAccountsDeps();

  const result = await registerSourceAccount(deps, {
    panelUrl: String(formData.get("panelUrl") ?? ""),
    panelUsername: String(formData.get("panelUsername") ?? ""),
    label: String(formData.get("label") ?? "") || null,
  });

  if (!result.ok) {
    return { error: ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}

export async function archiveSourceAccountAction(
  _state: SourceAccountFormState,
  formData: FormData,
): Promise<SourceAccountFormState> {
  const deps = await adminSourceAccountsDeps();

  const result = await archiveSourceAccount(deps, String(formData.get("accountId") ?? ""));

  if (!result.ok) {
    return { error: ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}
