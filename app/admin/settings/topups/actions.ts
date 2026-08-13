"use server";

import { refresh } from "next/cache";

import { createTopUpLimits } from "@/modules/wallet/domain/top-up-limits";
import { InvalidMoneyError } from "@/shared/money/money";

import { adminTopUpSettingsDeps } from "./admin-topup-settings";

export type TopUpSettingsFormState =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }
  | undefined;

/**
 * `Number()` is too permissive for a form field — it maps "", " ", "1e3" and
 * "0x10" to numbers. Same guard as the top-up amount itself.
 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export async function saveTopUpLimitsAction(
  _state: TopUpSettingsFormState,
  formData: FormData,
): Promise<TopUpSettingsFormState> {
  const deps = await adminTopUpSettingsDeps();

  const minAmountMinor = parseAmount(String(formData.get("minAmountMinor") ?? ""));
  const maxAmountMinor = parseAmount(String(formData.get("maxAmountMinor") ?? ""));

  if (minAmountMinor === null || maxAmountMinor === null) {
    return { ok: false, error: "Ambos montos deben ser números enteros de pesos." };
  }

  try {
    // The domain owns the rules (positive minimum, max not below min); this
    // action only turns the throw into a message the operator can read.
    const limits = createTopUpLimits({ minAmountMinor, maxAmountMinor });
    await deps.topUpSettings.save(limits, deps.actorId);
  } catch (error) {
    if (error instanceof InvalidMoneyError) {
      return {
        ok: false,
        error:
          maxAmountMinor < minAmountMinor
            ? "El máximo no puede ser menor que el mínimo: ninguna recarga sería aceptada."
            : "El mínimo debe ser mayor que cero.",
      };
    }
    throw error;
  }

  refresh();
  return { ok: true };
}
