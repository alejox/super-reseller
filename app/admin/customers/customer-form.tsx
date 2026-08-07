"use client";

import { useActionState, useEffect, useRef } from "react";

import { createCustomerAction } from "./actions";

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export type TierOption = Readonly<{ id: string; code: string; name: string }>;

/**
 * Creates a customer account (CI: Only ADMIN Provisions A Customer).
 * Mirrors `app/admin/resellers/reseller-form.tsx`'s `CreateResellerForm`:
 * the validation, the hashing, and the tier check all stay on the server.
 */
export function CreateCustomerForm({ tiers }: Readonly<{ tiers: readonly TierOption[] }>) {
  const [state, action, pending] = useActionState(createCustomerAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state === undefined) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  return (
    <form action={action} className="mt-6 space-y-3 border-t border-zinc-200 pt-6" ref={formRef}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Correo electrónico</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="email"
            placeholder="cliente@ejemplo.com"
            required
            type="email"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Contraseña inicial</span>
          <input
            autoComplete="new-password"
            className={FIELD_CLASS}
            name="password"
            placeholder="Mínimo 10 caracteres"
            required
            type="password"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Nivel de precio</span>
          <select className={FIELD_CLASS} name="priceTierId" required>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.code} · {tier.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creando…" : "Crear cliente"}
        </button>
        <p className="text-xs text-zinc-500">
          Entregue la contraseña por un canal seguro; no vuelve a mostrarse.
        </p>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
