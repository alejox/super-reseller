"use client";

import { useActionState, useEffect, useRef } from "react";

import { createPriceTierAction, createServiceAction, type CatalogFormState } from "./actions";

/**
 * The two creation forms. Client Components only because `useActionState`
 * needs to surface the pending flag and the server's validation message —
 * the validation itself stays on the server, where it cannot be bypassed.
 */

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";

const SUBMIT_CLASS =
  "inline-flex items-center justify-center rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400";

function FieldError({ state }: Readonly<{ state: CatalogFormState }>) {
  if (state === undefined) return null;
  return (
    <p className="text-sm font-medium text-red-600" role="alert">
      {state.error}
    </p>
  );
}

/**
 * Clears the form once the server reports success. Without this the fields
 * keep the values that were just persisted, which reads as "nothing happened"
 * and invites a duplicate submission.
 */
function useResetOnSuccess(state: CatalogFormState, pending: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!pending && state === undefined) {
      ref.current?.reset();
    }
  }, [state, pending]);
  return ref;
}

export function CreatePriceTierForm() {
  const [state, action, pending] = useActionState(createPriceTierAction, undefined);
  const formRef = useResetOnSuccess(state, pending);

  return (
    <form action={action} className="mt-6 space-y-3 border-t border-zinc-200 pt-6" ref={formRef}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Código</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="code"
            placeholder="MAYOR"
            required
            type="text"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="name"
            placeholder="Mayorista"
            required
            type="text"
          />
        </label>
        <button className={`${SUBMIT_CLASS} sm:mt-[1.375rem]`} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear nivel"}
        </button>
      </div>
      <FieldError state={state} />
    </form>
  );
}

export function CreateServiceForm() {
  const [state, action, pending] = useActionState(createServiceAction, undefined);
  const formRef = useResetOnSuccess(state, pending);

  return (
    <form action={action} className="mt-6 space-y-3 border-t border-zinc-200 pt-6" ref={formRef}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Identificador</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="slug"
            placeholder="netflix"
            required
            type="text"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="name"
            placeholder="Netflix"
            required
            type="text"
          />
        </label>
        <button className={`${SUBMIT_CLASS} sm:mt-[1.375rem]`} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear servicio"}
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">Descripción (opcional)</span>
        <input
          autoComplete="off"
          className={FIELD_CLASS}
          name="description"
          placeholder="Streaming de video"
          type="text"
        />
      </label>
      <FieldError state={state} />
    </form>
  );
}
