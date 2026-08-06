"use server";

import { refresh } from "next/cache";

import { provisionReseller } from "@/modules/identity/application/admin/provision-reseller";
import { PRODUCTION_HASHER_PARAMS } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { MINIMUM_PASSWORD_LENGTH } from "@/modules/identity/application/admin/provision-admin";
import { topUpBalance } from "@/modules/wallet/application/admin/top-up-balance";
import { adminResellerDeps } from "./admin-resellers";

export type ResellerFormState = { readonly error: string } | undefined;

const ERRORS = {
  "email-invalid": "Ingrese un correo electrónico válido.",
  "email-taken": "Ya existe una cuenta con ese correo electrónico.",
  "password-too-short": `La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`,
  "tier-required": "Seleccione un nivel de precio.",
  "tier-unknown": "El nivel de precio seleccionado ya no existe.",
} as const;

const TOPUP_ERRORS = {
  "amount-invalid": "El monto debe ser un número entero de pesos mayor que cero.",
  "reseller-unknown": "El revendedor seleccionado ya no existe.",
} as const;

export async function topUpResellerAction(
  _state: ResellerFormState,
  formData: FormData,
): Promise<ResellerFormState> {
  const deps = await adminResellerDeps();

  const result = await topUpBalance(
    {
      wallet: deps.wallet,
      // The cross-module check the use case cannot import for itself: a
      // reseller is identity's fact. It matters more than most, because
      // `wallet_entry` has no foreign key to catch a mistyped id.
      resellerExists: async (resellerId) =>
        (await deps.users.listUsers()).some(
          (user) => user.role === "RESELLER" && user.resellerId === resellerId,
        ),
      actorId: deps.actorId,
    },
    {
      resellerId: String(formData.get("resellerId") ?? ""),
      amountMinor: String(formData.get("amountMinor") ?? ""),
      memo: String(formData.get("memo") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: TOPUP_ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}

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
