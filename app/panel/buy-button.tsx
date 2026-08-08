"use client";

import { useActionState } from "react";
import { buyPlanAction } from "./actions";

export function BuyButton({ planId }: Readonly<{ planId: string }>) {
  const [state, action, pending] = useActionState(buyPlanAction, undefined);

  return (
    <form action={action}>
      <input name="planId" type="hidden" value={planId} />
      <button
        className="px-4 py-2 border border-[#d0bcff] text-[#d0bcff] hover:bg-[#d0bcff]/10 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 relative"
        disabled={pending}
        type="submit"
      >
        {pending ? "Comprando…" : "Purchase"}
      </button>
      {state !== undefined && (
        <p className="absolute bottom-1 right-6 max-w-xs text-xs font-medium text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
