"use server";

import { refresh } from "next/cache";

import { provisionReseller } from "@/modules/identity/application/admin/provision-reseller";
import { PRODUCTION_HASHER_PARAMS } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { MINIMUM_PASSWORD_LENGTH } from "@/modules/identity/application/admin/provision-admin";
import { adminResellerDeps } from "./admin-resellers";

export type ResellerFormState = { readonly error: string } | undefined;

const ERRORS = {
  "email-invalid": "Ingrese un correo electrónico válido.",
  "email-taken": "Ya existe una cuenta con ese correo electrónico.",
  "password-too-short": `La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`,
  "tier-required": "Seleccione un nivel de precio.",
  "tier-unknown": "El nivel de precio seleccionado ya no existe.",
} as const;

export async function createResellerAction(
  _state: ResellerFormState,
  formData: FormData,
): Promise<ResellerFormState> {
  const deps = await adminResellerDeps();

  const result = await provisionReseller(
    {
      users: deps.credentials,
      provisioning: deps.provisioning,
      // Production parameters: this hash is a real credential, never seeded
      // with the cheap test parameters.
      hasher: new NodeRsArgon2Hasher(PRODUCTION_HASHER_PARAMS),
      // The cross-module lookup the use case cannot import for itself.
      tierExists: async (priceTierId) =>
        (await deps.catalog.listPriceTiers()).some((tier) => tier.id === priceTierId),
      newUserId: () => crypto.randomUUID(),
      newResellerId: () => crypto.randomUUID(),
    },
    {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      priceTierId: String(formData.get("priceTierId") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}
