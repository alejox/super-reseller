"use client";

import { useActionState, useEffect, useRef } from "react";

import { createProviderAccountAction } from "./actions";

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";

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
    <form action={action} className="mt-6 space-y-3 border-t border-zinc-200 pt-6" ref={formRef}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Servicio</span>
          <select className={FIELD_CLASS} name="serviceId" required>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Usuario en el panel</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="panelUsername"
            placeholder="usuario_real"
            required
            type="text"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Etiqueta (opcional)</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="label"
            placeholder="Cuenta principal"
            type="text"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={pending}
          type="submit"
        >
          {pending ? "Agregando…" : "Agregar cuenta"}
        </button>
        <p className="text-xs text-zinc-500">
          No pedimos su contraseña de ese servicio: solo el usuario con el que la identifica.
        </p>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
