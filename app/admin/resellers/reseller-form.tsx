"use client";

import { useActionState, useEffect, useRef } from "react";

import { createResellerAction, topUpResellerAction } from "./actions";

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export type TierOption = Readonly<{ id: string; code: string; name: string }>;

/**
 * Creates a reseller account. Client Component only because `useActionState`
 * surfaces the pending flag and the server's message — the validation, the
 * hashing and the tier check all stay on the server.
 */
export function CreateResellerForm({ tiers }: Readonly<{ tiers: readonly TierOption[] }>) {
  const [state, action, pending] = useActionState(createResellerAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state === undefined) {
      // Clearing matters more here than on the catalog forms: the password
      // field would otherwise keep a live credential on screen.
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
            placeholder="juan@ejemplo.com"
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
          {pending ? "Creando…" : "Crear revendedor"}
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

/**
 * Credits one reseller's wallet. Rendered per row, so the reseller id is a
 * hidden field rather than a select: the operator is already looking at the
 * account they mean.
 */
export function TopUpForm({ resellerId }: Readonly<{ resellerId: string }>) {
  const [state, action, pending] = useActionState(topUpResellerAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state === undefined) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  return (
    <form action={action} className="flex flex-col gap-1" ref={formRef}>
      <input name="resellerId" type="hidden" value={resellerId} />
      <div className="flex items-center gap-1">
        <input
          aria-label="Monto a recargar"
          className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 focus:border-emerald-500 focus:outline-none"
          inputMode="numeric"
          min="1"
          name="amountMinor"
          placeholder="50000"
          step="1"
          type="number"
        />
        <input
          aria-label="Referencia"
          className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 focus:border-emerald-500 focus:outline-none"
          name="memo"
          placeholder="Referencia"
          type="text"
        />
        <button
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "Recargar"}
        </button>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
