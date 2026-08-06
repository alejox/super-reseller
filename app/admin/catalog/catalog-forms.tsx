"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createPlanAction,
  createPriceTierAction,
  createServiceAction,
  setPlanPriceAction,
  type CatalogFormState,
} from "./actions";

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

export type TierOption = Readonly<{ id: string; code: string; name: string }>;

/**
 * Adds a plan to one service, with its price at one tier. Both halves are one
 * form because they are one operation: a plan with no price is invisible to
 * every reseller, so the screen never offers a way to create half of it.
 */
export function CreatePlanForm({
  serviceId,
  tiers,
}: Readonly<{ serviceId: string; tiers: readonly TierOption[] }>) {
  const [state, action, pending] = useActionState(createPlanAction, undefined);
  const formRef = useResetOnSuccess(state, pending);

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-zinc-200 pt-4" ref={formRef}>
      <input name="serviceId" type="hidden" value={serviceId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
          <input autoComplete="off" className={FIELD_CLASS} name="name" placeholder="1 Pantalla" required type="text" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Tipo</span>
          <select className={FIELD_CLASS} defaultValue="SCREEN" name="kind">
            <option value="SCREEN">Pantalla</option>
            <option value="FULL_ACCOUNT">Cuenta completa</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Duración (días)</span>
          <input
            className={FIELD_CLASS}
            inputMode="numeric"
            min="1"
            name="durationDays"
            placeholder="30"
            required
            step="1"
            type="number"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Nivel del precio inicial</span>
          <select className={FIELD_CLASS} name="priceTierId" required>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.code} · {tier.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Precio inicial (COP)</span>
          <input
            className={FIELD_CLASS}
            inputMode="numeric"
            min="0"
            name="amountMinor"
            placeholder="12000"
            required
            step="1"
            type="number"
          />
        </label>
        <button className={`${SUBMIT_CLASS} sm:mt-[1.375rem]`} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear plan"}
        </button>
      </div>
      <FieldError state={state} />
    </form>
  );
}

/**
 * Sets one plan's price at one tier. Rendered per cell of the price matrix,
 * so the same control both fills an empty tier and replaces an existing
 * amount — one append-only write either way.
 */
export function SetPlanPriceForm({
  planId,
  tierId,
  currentAmount,
}: Readonly<{ planId: string; tierId: string; currentAmount: number | null }>) {
  const [state, action, pending] = useActionState(setPlanPriceAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input name="planId" type="hidden" value={planId} />
      <input name="priceTierId" type="hidden" value={tierId} />
      <div className="flex items-center gap-1">
        <input
          aria-label="Precio"
          className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 focus:border-emerald-500 focus:outline-none"
          defaultValue={currentAmount ?? ""}
          inputMode="numeric"
          min="0"
          name="amountMinor"
          placeholder="sin precio"
          step="1"
          type="number"
        />
        <button
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "Guardar"}
        </button>
      </div>
      <FieldError state={state} />
    </form>
  );
}
