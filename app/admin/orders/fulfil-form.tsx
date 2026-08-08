"use client";

import { useActionState } from "react";

import { fulfilOrderAction } from "./actions";

import { buttonVariants } from "@/app/_components/ui/button";
import { COMPACT_FIELD_CLASS } from "@/app/_components/ui/field";

export function FulfilForm({ orderId }: Readonly<{ orderId: string }>) {
  const [state, action, pending] = useActionState(fulfilOrderAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input name="orderId" type="hidden" value={orderId} />
      <div className="flex items-center gap-1">
        <input
          aria-label="Nota de entrega"
          className={`w-40 ${COMPACT_FIELD_CLASS}`}
          name="note"
          placeholder="Referencia de entrega"
          type="text"
        />
        <button
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "Marcar entregada"}
        </button>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
