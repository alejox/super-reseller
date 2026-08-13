"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PAYMENT_METHODS, type PaymentMethod } from "@/modules/wallet/domain/payment-request";
import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";
import { METHOD_LABELS } from "../payments/payment-labels";
import { createResellerAction, requestTopUpAction } from "./actions";

export type TierOption = Readonly<{ id: string; code: string; name: string }>;

/**
 * Creates a reseller account. Client Component only because `useActionState`
 * surfaces the pending flag and the server's message — the validation, the
 * hashing and the tier check all stay on the server.
 */
export function CreateResellerForm({ tiers }: Readonly<{ tiers: readonly TierOption[] }>) {
  const [state, action, pending] = useActionState(createResellerAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state === undefined) {
      // Clearing matters more here than on the catalog forms: the password
      // field would otherwise keep a live credential on screen.
      formRef.current?.reset();
    }
  }, [state, pending]);

  return (
    <form
      action={action}
      className="space-y-6"
      ref={formRef}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5 uppercase tracking-wider">Correo electrónico</label>
          <input
            autoComplete="off"
            className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 px-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors placeholder-[#958ea0]"
            name="email"
            placeholder="juan@ejemplo.com"
            required
            type="email"
          />
        </div>
        <div>
          <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5 uppercase tracking-wider">Contraseña inicial</label>
          <input
            autoComplete="new-password"
            className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 px-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors placeholder-[#958ea0] font-mono"
            name="password"
            placeholder="Mínimo 10 caracteres"
            required
            type="password"
          />
        </div>
        <div>
          <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5 uppercase tracking-wider">Nivel de precio</label>
          <select 
            className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 px-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors appearance-none cursor-pointer" 
            name="priceTierId" 
            required
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.code} · {tier.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          className="bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#3c0091] hover:opacity-90 transition-opacity px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]" 
          disabled={pending} 
          type="submit"
        >
          {pending ? "Creando…" : "Crear revendedor"}
        </button>
        <p className="text-xs text-[#cbc3d7]">
          Entregue la contraseña por un canal seguro; no vuelve a mostrarse.
        </p>
      </div>
      {state !== undefined && (
        <p className="text-sm font-medium text-[#ffb4ab]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function displayCop(amountMinor: number): string {
  return formatMoney(money(amountMinor, WALLET_CURRENCY), "es-CO");
}

export type TopUpFormProps = Readonly<{
  resellerId: string;
  resellerEmail: string;
  balanceMinor: number;
  minAmountMinor: number;
  maxAmountMinor: number;
}>;

/**
 * Files a payment claim for one reseller. Rendered per row, so the reseller id
 * is a hidden field rather than a select: the operator is already looking at
 * the account they mean.
 *
 * TWO STEPS, and the second one is not decoration (backlog A2). The button
 * this replaced credited a live balance on a single click, from a 24px-wide
 * input, with no summary of what was about to happen. The confirmation screen
 * shows the account, the amount, and the balance BEFORE and AFTER — and says
 * plainly that "after" only happens once somebody approves it.
 *
 * Everything shown here is re-checked on the server. The `min`/`max` below are
 * a courtesy for the operator, not a control: `requestTopUp` reads the limits
 * from the database on every call.
 */
export function TopUpForm(props: TopUpFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="px-3 py-1.5 rounded-md bg-[#222a3d] border border-[#494454] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-[10px] font-bold uppercase tracking-wider"
        onClick={() => setOpen(true)}
        type="button"
      >
        Recargar
      </button>

      {/* Mounted only while open, so every reopening starts from a fresh
          `useActionState` and fresh fields. That is what removes the need for
          an effect that resets state after a submit — a cascading render the
          React lint rule rightly refuses. */}
      {open && <TopUpDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function TopUpDialog({
  resellerId,
  resellerEmail,
  balanceMinor,
  minAmountMinor,
  maxAmountMinor,
  onClose,
}: TopUpFormProps & Readonly<{ onClose: () => void }>) {
  const [state, action, pending] = useActionState(requestTopUpAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  // A blank or malformed amount must not render as "NaN" or as $0 in the
  // summary; the operator is being asked to confirm a number.
  const parsedAmount = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : null;
  const canReview =
    parsedAmount !== null && parsedAmount > 0 && reference.trim() !== "" && proofUrl.trim() !== "";

  const close = onClose;

  if (state?.ok === true) {
    return (
      <div
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
      >
        <div className="w-full max-w-lg rounded-xl border border-[#4cd7f6]/30 bg-[#171f33] p-6 text-left shadow-2xl">
          <h3 className="text-lg font-semibold text-[#dae2fd]">Solicitud registrada</h3>
          <p className="mt-2 text-sm text-[#cbc3d7]" role="status">
            {state.message}
          </p>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#a078ff] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#3c0091] transition-opacity hover:opacity-90"
              onClick={close}
              type="button"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
        <div
          aria-labelledby={`topup-title-${resellerId}`}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#494454] bg-[#171f33] shadow-2xl">
            <div className="border-b border-[#494454] p-5 text-left">
              <h3 className="text-lg font-semibold text-[#dae2fd]" id={`topup-title-${resellerId}`}>
                {confirming ? "Confirmar solicitud de recarga" : "Registrar pago recibido"}
              </h3>
              <p className="mt-1 text-xs text-[#cbc3d7]">{resellerEmail}</p>
            </div>

            <form action={action} className="p-5 text-left" ref={formRef}>
              <input name="resellerId" type="hidden" value={resellerId} />
              <input name="method" type="hidden" value={method} />
              <input name="amountMinor" type="hidden" value={amount} />
              <input name="reference" type="hidden" value={reference} />
              <input name="proofUrl" type="hidden" value={proofUrl} />

              {confirming ? (
                <div className="flex flex-col gap-3">
                  <dl className="divide-y divide-[#494454]/50 rounded-lg border border-[#494454] bg-[#0b1326] px-4">
                    <div className="flex justify-between py-2.5 text-sm">
                      <dt className="text-[#cbc3d7]">Revendedor</dt>
                      <dd className="font-medium text-[#dae2fd]">{resellerEmail}</dd>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      <dt className="text-[#cbc3d7]">Monto</dt>
                      <dd className="font-semibold text-[#4cd7f6]">
                        {displayCop(parsedAmount ?? 0)}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      <dt className="text-[#cbc3d7]">Saldo actual</dt>
                      <dd className="font-medium text-[#dae2fd]">{displayCop(balanceMinor)}</dd>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      {/* Not "saldo resultante": nothing results from this
                          click. The balance moves when somebody approves it. */}
                      <dt className="text-[#cbc3d7]">Saldo si se aprueba</dt>
                      <dd className="font-semibold text-[#dae2fd]">
                        {displayCop(balanceMinor + (parsedAmount ?? 0))}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      <dt className="text-[#cbc3d7]">Medio de pago</dt>
                      <dd className="font-medium text-[#dae2fd]">{METHOD_LABELS[method]}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-2.5 text-sm">
                      <dt className="text-[#cbc3d7]">Referencia</dt>
                      <dd className="truncate font-mono text-[#dae2fd]">{reference}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-2.5 text-sm">
                      <dt className="text-[#cbc3d7]">Comprobante</dt>
                      <dd className="truncate font-mono text-xs text-[#dae2fd]">{proofUrl}</dd>
                    </div>
                  </dl>

                  <p className="rounded-lg border border-[#f3ba2f]/30 bg-[#f3ba2f]/10 px-3 py-2 text-xs text-[#f3ba2f]">
                    Esta solicitud queda PENDIENTE. El saldo no se acredita hasta que se apruebe en
                    Pagos por validar.
                  </p>

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      className="rounded-lg border border-[#494454] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#dae2fd] transition-colors hover:bg-[#2d3449]"
                      disabled={pending}
                      onClick={() => setConfirming(false)}
                      type="button"
                    >
                      Volver
                    </button>
                    <button
                      className="rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#a078ff] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#3c0091] transition-opacity hover:opacity-90 disabled:opacity-50"
                      disabled={pending}
                      type="submit"
                    >
                      {pending ? "Enviando…" : "Confirmar y enviar a validación"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#cbc3d7]"
                      htmlFor={`amount-${resellerId}`}
                    >
                      Monto recibido (COP)
                    </label>
                    <input
                      className="w-full rounded-lg border border-[#494454] bg-[#2d3449] px-4 py-2.5 font-mono text-sm text-[#dae2fd] transition-colors placeholder-[#958ea0] focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
                      id={`amount-${resellerId}`}
                      inputMode="numeric"
                      max={maxAmountMinor}
                      min={minAmountMinor}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder={String(minAmountMinor)}
                      step="1"
                      type="number"
                      value={amount}
                    />
                    <p className="mt-1 text-[11px] text-[#cbc3d7]">
                      Entre {displayCop(minAmountMinor)} y {displayCop(maxAmountMinor)}.
                    </p>
                  </div>

                  <div>
                    <label
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#cbc3d7]"
                      htmlFor={`method-${resellerId}`}
                    >
                      Medio de pago
                    </label>
                    <select
                      className="w-full cursor-pointer rounded-lg border border-[#494454] bg-[#2d3449] px-4 py-2.5 text-sm text-[#dae2fd] transition-colors focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
                      id={`method-${resellerId}`}
                      onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                      value={method}
                    >
                      {PAYMENT_METHODS.map((option) => (
                        <option key={option} value={option}>
                          {METHOD_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#cbc3d7]"
                      htmlFor={`reference-${resellerId}`}
                    >
                      Referencia del pago
                    </label>
                    <input
                      className="w-full rounded-lg border border-[#494454] bg-[#2d3449] px-4 py-2.5 font-mono text-sm text-[#dae2fd] transition-colors placeholder-[#958ea0] focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
                      id={`reference-${resellerId}`}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Ej: 4419283746"
                      type="text"
                      value={reference}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#cbc3d7]"
                      htmlFor={`proof-${resellerId}`}
                    >
                      Comprobante (enlace a la imagen)
                    </label>
                    <input
                      className="w-full rounded-lg border border-[#494454] bg-[#2d3449] px-4 py-2.5 text-sm text-[#dae2fd] transition-colors placeholder-[#958ea0] focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
                      id={`proof-${resellerId}`}
                      onChange={(event) => setProofUrl(event.target.value)}
                      placeholder="https://…"
                      type="url"
                      value={proofUrl}
                    />
                    <p className="mt-1 text-[11px] text-[#cbc3d7]">
                      Obligatorio. Quien valide el pago necesita verlo.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      className="rounded-lg border border-[#494454] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#dae2fd] transition-colors hover:bg-[#2d3449]"
                      onClick={close}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className="rounded-lg bg-[#222a3d] border border-[#494454] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#dae2fd] transition-colors hover:bg-[#31394d] disabled:opacity-50"
                      disabled={!canReview}
                      onClick={() => setConfirming(true)}
                      type="button"
                    >
                      Revisar
                    </button>
                  </div>
                </div>
              )}

              {state?.ok === false && (
                <p className="mt-3 text-sm font-medium text-[#ffb4ab]" role="alert">
                  {state.error}
                </p>
              )}
            </form>
          </div>
        </div>
  );
}
