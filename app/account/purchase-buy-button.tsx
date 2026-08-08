"use client";

import { useActionState } from "react";

import { purchaseAction } from "./actions";

import { buttonVariants } from "@/app/_components/ui/button";

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
        className={buttonVariants({ variant: "primary", size: "sm" })}
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
