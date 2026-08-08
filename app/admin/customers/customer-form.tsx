"use client";

import { useActionState, useEffect, useRef } from "react";

import { createCustomerAction } from "./actions";

import { buttonVariants } from "@/app/_components/ui/button";
import { Field, FIELD_CLASS } from "@/app/_components/ui/field";

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
    <form
      action={action}
      className="mt-6 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      ref={formRef}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Correo electrónico">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="email"
            placeholder="cliente@ejemplo.com"
            required
            type="email"
          />
        </Field>
        <Field label="Contraseña inicial">
          <input
            autoComplete="new-password"
            className={FIELD_CLASS}
            name="password"
            placeholder="Mínimo 10 caracteres"
            required
            type="password"
          />
        </Field>
        <Field label="Nivel de precio">
          <select className={FIELD_CLASS} name="priceTierId" required>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.code} · {tier.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button className={buttonVariants()} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear cliente"}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Entregue la contraseña por un canal seguro; no vuelve a mostrarse.
        </p>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
