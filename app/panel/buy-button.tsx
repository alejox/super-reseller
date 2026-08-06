"use client";

import { useActionState } from "react";

import { buyPlanAction } from "./actions";

/**
 * One form per plan row. The only field is the plan id — the price is
 * resolved server-side from the reseller's own tier, so there is nothing
 * about the amount for the client to send or tamper with.
 */
export function BuyButton({ planId }: Readonly<{ planId: string }>) {
  const [state, action, pending] = useActionState(buyPlanAction, undefined);

  return (
    <form action={action}>
      <input name="planId" type="hidden" value={planId} />
      <button
        className="rounded-md bg-zinc-950 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        disabled={pending}
        type="submit"
      >
        {pending ? "Comprando…" : "Comprar"}
      </button>
      {state !== undefined && (
        <p className="mt-1 max-w-xs text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
