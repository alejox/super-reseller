"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";

import { saveTopUpLimitsAction } from "./actions";

function preview(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return "—";
  return formatMoney(money(Number(trimmed), WALLET_CURRENCY), "es-CO");
}

/**
 * The real limits form.
 *
 * The live preview under each field is not decoration: these are COP PESOS,
 * not cents, and the screen this replaced showed "10.00" for a value the
 * ledger would have read as ten pesos. Seeing the formatted amount while
 * typing is what stops that class of mistake from being shipped again.
 */
export function TopUpLimitsForm({
  minAmountMinor,
  maxAmountMinor,
}: Readonly<{ minAmountMinor: number; maxAmountMinor: number }>) {
  const [state, action, pending] = useActionState(saveTopUpLimitsAction, undefined);
  const [min, setMin] = useState(String(minAmountMinor));
  const [max, setMax] = useState(String(maxAmountMinor));

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#cbc3d7]"
            htmlFor="minAmountMinor"
          >
            Mínimo por recarga
          </label>
          <input
            className="w-full rounded-lg border border-[#494454] bg-[#2d3449] px-4 py-2.5 font-mono text-sm text-[#dae2fd] transition-colors focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
            id="minAmountMinor"
            inputMode="numeric"
            min="1"
            name="minAmountMinor"
            onChange={(event) => setMin(event.target.value)}
            step="1"
            type="number"
            value={min}
          />
          <p className="mt-1 text-[11px] text-[#cbc3d7]">{preview(min)}</p>
        </div>

        <div>
          <label
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#cbc3d7]"
            htmlFor="maxAmountMinor"
          >
            Máximo por recarga
          </label>
          <input
            className="w-full rounded-lg border border-[#494454] bg-[#2d3449] px-4 py-2.5 font-mono text-sm text-[#dae2fd] transition-colors focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
            id="maxAmountMinor"
            inputMode="numeric"
            min="1"
            name="maxAmountMinor"
            onChange={(event) => setMax(event.target.value)}
            step="1"
            type="number"
            value={max}
          />
          <p className="mt-1 text-[11px] text-[#cbc3d7]">{preview(max)}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 border-t border-[#494454]/30 pt-4">
        {state?.ok === true && (
          <p className="text-sm font-medium text-[#4cd7f6]" role="status">
            Límites guardados.
          </p>
        )}
        {state?.ok === false && (
          <p className="text-sm font-medium text-[#ffb4ab]" role="alert">
            {state.error}
          </p>
        )}
        <button
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#6d3bd7] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#3c0091] shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          <Save className="h-4 w-4" />
          {pending ? "Guardando…" : "Guardar límites"}
        </button>
      </div>
    </form>
  );
}
