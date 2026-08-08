"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createPlanAction,
  createPriceTierAction,
  createServiceAction,
  setPlanPriceAction,
  type CatalogFormState,
} from "./actions";

import { buttonVariants } from "@/app/_components/ui/button";
import { COMPACT_FIELD_CLASS, Field, FIELD_CLASS } from "@/app/_components/ui/field";

/**
 * The two creation forms. Client Components only because `useActionState`
 * needs to surface the pending flag and the server's validation message —
 * the validation itself stays on the server, where it cannot be bypassed.
 */

function FieldError({ state }: Readonly<{ state: CatalogFormState }>) {
  if (state === undefined) return null;
  return (
    <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
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
    <form
      action={action}
      className="mt-6 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      ref={formRef}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
        <Field label="Código">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="code"
            placeholder="MAYOR"
            required
            type="text"
          />
        </Field>
        <Field label="Nombre">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="name"
            placeholder="Mayorista"
            required
            type="text"
          />
        </Field>
        <button className={buttonVariants({ className: "sm:mt-[1.375rem]" })} disabled={pending} type="submit">
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
    <form
      action={action}
      className="mt-6 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      ref={formRef}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
        <Field label="Identificador">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="slug"
            placeholder="netflix"
            required
            type="text"
          />
        </Field>
        <Field label="Nombre">
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            name="name"
            placeholder="Netflix"
            required
            type="text"
          />
        </Field>
        <button className={buttonVariants({ className: "sm:mt-[1.375rem]" })} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear servicio"}
        </button>
      </div>
      <Field label="Descripción (opcional)">
        <input
          autoComplete="off"
          className={FIELD_CLASS}
          name="description"
          placeholder="Streaming de video"
          type="text"
        />
      </Field>
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
    <form
      action={action}
      className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
      ref={formRef}
    >
      <input name="serviceId" type="hidden" value={serviceId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre">
          <input autoComplete="off" className={FIELD_CLASS} name="name" placeholder="1 Pantalla" required type="text" />
        </Field>
        <Field label="Tipo">
          <select className={FIELD_CLASS} defaultValue="SCREEN" name="kind">
            <option value="SCREEN">Pantalla</option>
            <option value="FULL_ACCOUNT">Cuenta completa</option>
          </select>
        </Field>
        <Field label="Duración (días)">
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
        </Field>
        <Field label="Nivel del precio inicial">
          <select className={FIELD_CLASS} name="priceTierId" required>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.code} · {tier.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_auto]">
        <Field label="Precio inicial (COP)">
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
        </Field>
        <button className={buttonVariants({ className: "sm:mt-[1.375rem]" })} disabled={pending} type="submit">
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
          className={`w-28 ${COMPACT_FIELD_CLASS}`}
          defaultValue={currentAmount ?? ""}
          inputMode="numeric"
          min="0"
          name="amountMinor"
          placeholder="sin precio"
          step="1"
          type="number"
        />
        <button
          className={buttonVariants({ variant: "outline", size: "sm" })}
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
