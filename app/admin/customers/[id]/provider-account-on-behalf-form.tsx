"use client";

import { useActionState, useEffect, useRef } from "react";

import { createProviderAccountForCustomerAction } from "./actions";

import { buttonVariants } from "@/app/_components/ui/button";
import { Field, FIELD_CLASS } from "@/app/_components/ui/field";

export type ServiceOption = Readonly<{ id: string; name: string }>;

/**
 * PA: ADMIN May Create A Provider Account On A Customer's Behalf.
 * `targetUserId` travels as a hidden field — mirrors
 * `app/admin/orders/fulfil-form.tsx`'s `orderId` hidden input — never as a
 * value the admin types, so the account can only ever be created for the
 * customer this page is already showing.
 */
export function CreateProviderAccountOnBehalfForm({
  targetUserId,
  services,
}: Readonly<{ targetUserId: string; services: readonly ServiceOption[] }>) {
  const [state, action, pending] = useActionState(
    createProviderAccountForCustomerAction,
    undefined,
  );
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
      <input name="targetUserId" type="hidden" value={targetUserId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Servicio">
          <select className={FIELD_CLASS} name="serviceId" required>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Usuario en el panel">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="panelUsername"
            placeholder="usuario_real"
            required
            type="text"
          />
        </Field>
        <Field label="Etiqueta (opcional)">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="label"
            placeholder="Cuenta principal"
            type="text"
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button className={buttonVariants()} disabled={pending} type="submit">
          {pending ? "Agregando…" : "Agregar cuenta"}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Creación de soporte, a nombre del cliente.
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
