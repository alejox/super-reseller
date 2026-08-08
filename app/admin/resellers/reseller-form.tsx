"use client";

import { useActionState, useEffect, useRef } from "react";
import { createResellerAction, topUpResellerAction } from "./actions";

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
    <form
      action={action}
      className="space-y-6"
      ref={formRef}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5 uppercase tracking-wider">Correo electrónico</label>
          <input
            autoComplete="off"
            className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 px-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors placeholder-[#958ea0]"
            name="email"
            placeholder="juan@ejemplo.com"
            required
            type="email"
          />
        </div>
        <div>
          <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5 uppercase tracking-wider">Contraseña inicial</label>
          <input
            autoComplete="new-password"
            className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 px-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors placeholder-[#958ea0] font-mono"
            name="password"
            placeholder="Mínimo 10 caracteres"
            required
            type="password"
          />
        </div>
        <div>
          <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5 uppercase tracking-wider">Nivel de precio</label>
          <select 
            className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 px-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors appearance-none cursor-pointer" 
            name="priceTierId" 
            required
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.code} · {tier.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          className="bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#3c0091] hover:opacity-90 transition-opacity px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]" 
          disabled={pending} 
          type="submit"
        >
          {pending ? "Creando…" : "Crear revendedor"}
        </button>
        <p className="text-xs text-[#cbc3d7]">
          Entregue la contraseña por un canal seguro; no vuelve a mostrarse.
        </p>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-[#ffb4ab]" role="alert">
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
      <div className="flex items-center gap-2">
        <input
          aria-label="Monto a recargar"
          className="w-24 bg-[#0b1326] border border-[#494454] rounded-md py-1.5 px-3 text-[#dae2fd] text-xs focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors placeholder-[#958ea0] font-mono text-center"
          inputMode="numeric"
          min="1"
          name="amountMinor"
          placeholder="$50"
          step="1"
          type="number"
        />
        <input
          aria-label="Referencia"
          className="w-32 bg-[#0b1326] border border-[#494454] rounded-md py-1.5 px-3 text-[#dae2fd] text-xs focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors placeholder-[#958ea0]"
          name="memo"
          placeholder="Ref..."
          type="text"
        />
        <button
          className="px-3 py-1.5 rounded-md bg-[#222a3d] border border-[#494454] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "TopUp"}
        </button>
      </div>
      {state !== undefined && (
        <p className="text-xs font-medium text-[#ffb4ab]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
