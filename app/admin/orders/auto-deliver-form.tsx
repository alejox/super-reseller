"use client";

import { useActionState } from "react";
import { autoDeliverOrderAction } from "./actions";
import { buttonVariants } from "@/app/_components/ui/button";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoDeliverForm({ orderId }: Readonly<{ orderId: string }>) {
  const [state, action, pending] = useActionState(autoDeliverOrderAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success && state?.accountId) {
      router.push(`/admin/inventory/delivery/${state.accountId}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input name="orderId" type="hidden" value={orderId} />
      <button
        className={`${buttonVariants({ variant: "primary", size: "sm" })} flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#6d3bd7] text-white`}
        disabled={pending}
        type="submit"
      >
        <Zap className="w-4 h-4" />
        {pending ? "Entregando..." : "Auto-Entregar Stock"}
      </button>
      {state?.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
