"use server";

import { refresh } from "next/cache";

import { provisionReseller } from "@/modules/identity/application/admin/provision-reseller";
import { PRODUCTION_HASHER_PARAMS } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { MINIMUM_PASSWORD_LENGTH } from "@/modules/identity/application/admin/provision-admin";
import { requestTopUp } from "@/modules/wallet/application/admin/request-top-up";
import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";
import { adminResellerDeps } from "./admin-resellers";

export type ResellerFormState = { readonly error: string } | undefined;

/**
 * The top-up form needs a SUCCESS state, which creating a reseller never did.
 * "Nothing went wrong" is the wrong feedback here: the operator has to learn
 * that the money was NOT credited and the claim is waiting for validation, or
 * they will file it again.
 */
export type TopUpFormState =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly error: string }
  | undefined;

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
  "method-invalid": "Seleccione un medio de pago válido.",
  "reference-required": "Ingrese la referencia del pago.",
  "proof-required": "Adjunte el comprobante del pago antes de enviarlo a validación.",
  "reference-taken":
    "Esa referencia ya fue usada en un pago aprobado. Verifique que no sea un pago duplicado.",
} as const;

/**
 * Files a payment claim. It does NOT credit anything — the reseller's balance
 * is untouched until an admin approves the claim in `/admin/payments`.
 */
export async function requestTopUpAction(
  _state: TopUpFormState,
  formData: FormData,
): Promise<TopUpFormState> {
  const deps = await adminResellerDeps();

  const result = await requestTopUp(
    {
      paymentRequests: deps.paymentRequests,
      settings: deps.topUpSettings,
      // The cross-module check the use case cannot import for itself: a
      // reseller is identity's fact. It matters more than most, because
      // `payment_request` has no foreign key to catch a mistyped id.
      resellerExists: async (resellerId) =>
        (await deps.users.listUsers()).some(
          (user) => user.role === "RESELLER" && user.resellerId === resellerId,
        ),
      actorId: deps.actorId,
    },
    {
      resellerId: String(formData.get("resellerId") ?? ""),
      amountMinor: String(formData.get("amountMinor") ?? ""),
      method: String(formData.get("method") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      proofUrl: String(formData.get("proofUrl") ?? ""),
    },
  );

  if (!result.ok) {
    if (result.reason === "below-minimum" || result.reason === "above-maximum") {
      const bound = formatMoney(money(result.limitMinor, WALLET_CURRENCY), "es-CO");
      return {
        ok: false,
        error:
          result.reason === "below-minimum"
            ? `El monto mínimo por recarga es ${bound}.`
            : `El monto máximo por recarga es ${bound}.`,
      };
    }
    return { ok: false, error: TOPUP_ERRORS[result.reason] };
  }

  refresh();
  return {
    ok: true,
    message: `Solicitud enviada a validación. El saldo NO se acreditó todavía.`,
  };
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
