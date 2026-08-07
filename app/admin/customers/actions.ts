"use server";

import { refresh } from "next/cache";

import { provisionCustomer } from "@/modules/identity/application/admin/provision-customer";
import { PRODUCTION_HASHER_PARAMS } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { MINIMUM_PASSWORD_LENGTH } from "@/modules/identity/application/admin/provision-admin";
import { adminCustomerDeps } from "./admin-customers";

export type CustomerFormState = { readonly error: string } | undefined;

const ERRORS = {
  "email-invalid": "Ingrese un correo electrónico válido.",
  "email-taken": "Ya existe una cuenta con ese correo electrónico.",
  "password-too-short": `La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`,
  "tier-required": "Seleccione un nivel de precio.",
  "tier-unknown": "El nivel de precio seleccionado ya no existe.",
} as const;

/**
 * CI: Only ADMIN Provisions A Customer — there is no self-registration
 * path. `provisionCustomer` mints the customer's own freestanding tenant
 * id (CI: Customer Gets Its Own Tenant Id); the tier lookup is injected
 * here because eslint forbids identity from importing catalog at all.
 */
export async function createCustomerAction(
  _state: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const deps = await adminCustomerDeps();

  const result = await provisionCustomer(
    {
      users: deps.credentials,
      provisioning: deps.provisioning,
      hasher: new NodeRsArgon2Hasher(PRODUCTION_HASHER_PARAMS),
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
