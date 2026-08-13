"use server";

import { refresh } from "next/cache";

import {
  approvePayment,
  rejectPayment,
} from "@/modules/wallet/application/admin/review-payment-request";

import { adminPaymentsDeps } from "./admin-payments";

/**
 * The two decisions. Approving is the ONLY place a balance grows now that
 * `topUpBalance` is gone.
 */

export type ReviewFormState = { readonly error: string } | undefined;

const ERRORS = {
  "not-actionable": "Esa solicitud ya fue decidida o no está disponible.",
  "reference-taken":
    "Esa referencia ya fue aprobada en otra solicitud. No se acreditó nada: revise si es un pago duplicado.",
  "reason-required": "Escriba el motivo del rechazo.",
} as const;

export async function approvePaymentAction(
  _state: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const deps = await adminPaymentsDeps();

  const result = await approvePayment(
    { paymentRequests: deps.paymentRequests, actorId: deps.actorId },
    {
      requestId: String(formData.get("requestId") ?? ""),
      note: String(formData.get("note") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}

export async function rejectPaymentAction(
  _state: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const deps = await adminPaymentsDeps();

  const result = await rejectPayment(
    { paymentRequests: deps.paymentRequests, actorId: deps.actorId },
    {
      requestId: String(formData.get("requestId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}
