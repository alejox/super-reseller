"use client";

import { useActionState } from "react";

import { purchaseAction } from "./actions";

/**
 * One form per duration row — mirrors `app/panel/buy-button.tsx`. The price
 * is never a field here: it is resolved server-side from the plan id at the
 * customer's own tier (CP: Price Resolves From The Catalog At Purchase
 * Time), so there is nothing about the amount for the client to submit.
 */
export function PurchaseBuyButton({
  planId,
  providerAccountId,
}: Readonly<{ planId: string; providerAccountId: string }>) {
  const [state, action, pending] = useActionState(purchaseAction, undefined);

  return (
    <form action={action}>
      <input name="planId" type="hidden" value={planId} />
      <input name="providerAccountId" type="hidden" value={providerAccountId} />
      <button
        className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={pending}
        type="submit"
      >
        {pending ? "Comprando…" : "Comprar"}
      </button>
      {state !== undefined && (
        <p className="mt-1 max-w-xs text-xs font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
