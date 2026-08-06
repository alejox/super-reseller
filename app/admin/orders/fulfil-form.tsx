"use client";

import { useActionState } from "react";

import { fulfilOrderAction } from "./actions";

export function FulfilForm({ orderId }: Readonly<{ orderId: string }>) {
  const [state, action, pending] = useActionState(fulfilOrderAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input name="orderId" type="hidden" value={orderId} />
      <div className="flex items-center gap-1">
        <input
          aria-label="Nota de entrega"
          className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 focus:border-emerald-500 focus:outline-none"
          name="note"
          placeholder="Referencia de entrega"
          type="text"
        />
        <button
          className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "Marcar entregada"}
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
