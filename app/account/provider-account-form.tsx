"use client";

import { useActionState, useEffect, useRef } from "react";

import { createProviderAccountAction } from "./actions";

import { buttonVariants } from "@/app/_components/ui/button";
import { Field, FIELD_CLASS } from "@/app/_components/ui/field";

export type ServiceOption = Readonly<{ id: string; name: string }>;

/**
 * PA: A Customer Creates Their Own Provider Account. Mirrors
 * `app/admin/customers/customer-form.tsx`'s `CreateCustomerForm`: validation
 * stays on the server, the tenant id is never a field on this form at all.
 */
export function CreateProviderAccountForm({
  services,
}: Readonly<{ services: readonly ServiceOption[] }>) {
  const [state, action, pending] = useActionState(createProviderAccountAction, undefined);
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
          No pedimos su contraseña de ese servicio: solo el usuario con el que la identifica.
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
