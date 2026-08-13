"use client";

import { useActionState, useState } from "react";

import { archiveSourceAccountAction, registerSourceAccountAction } from "./actions";

const INPUT_CLASS =
  "w-full rounded-md border border-[#494454] bg-[#0b1326] px-3 py-2 text-sm text-[#dae2fd] placeholder-[#958ea0] focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]";

const LABEL_CLASS = "mb-1 block text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]";

export function RegisterSourceAccountForm() {
  const [state, register, pending] = useActionState(registerSourceAccountAction, undefined);

  return (
    <form action={register} className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>Panel del proveedor</span>
          <input
            className={INPUT_CLASS}
            name="panelUrl"
            placeholder="https://proveedor.ejemplo.net/"
            required
            type="text"
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Usuario del panel</span>
          <input
            className={INPUT_CLASS}
            name="panelUsername"
            placeholder="MIUSUARIO"
            required
            type="text"
          />
        </label>
      </div>

      <label className="block">
        <span className={LABEL_CLASS}>Nota interna (opcional)</span>
        <input
          className={INPUT_CLASS}
          name="label"
          placeholder="Pool principal, pagada con la tarjeta AR"
          type="text"
        />
      </label>

      {state?.error && (
        <p className="rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 px-3 py-2 text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}

      <p className="text-xs leading-5 text-[#958ea0]">
        No se guarda la contraseña. El panel del proveedor pide un código de verificación al
        entrar, así que la sesión se abre a mano una vez y la automatización la reutiliza; cuando
        caduque, esta pantalla avisa para volver a entrar.
      </p>

      <div className="flex justify-end">
        <button
          className="rounded-md border border-[#4cd7f6]/30 bg-[#009eb9]/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#4cd7f6] transition-colors hover:bg-[#009eb9]/30 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Registrando…" : "Registrar cuenta"}
        </button>
      </div>
    </form>
  );
}

/**
 * Retiring an account is behind a confirm step for the same reason approving a
 * payment is: it is the click that changes what the operation can do next, and
 * the row it sits in looks like every other row.
 */
export function ArchiveSourceAccountButton({
  accountId,
  panelUsername,
}: Readonly<{ accountId: string; panelUsername: string }>) {
  const [state, archive, pending] = useActionState(archiveSourceAccountAction, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        className="rounded-md border border-[#494454] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#cbc3d7] transition-colors hover:bg-[#2d3449]"
        onClick={() => setConfirming(true)}
        type="button"
      >
        Retirar
      </button>
    );
  }

  return (
    <form action={archive} className="flex flex-col items-end gap-2">
      <input name="accountId" type="hidden" value={accountId} />
      <p className="max-w-xs text-right text-[11px] leading-4 text-[#cbc3d7]">
        <span className="font-semibold text-[#dae2fd]">{panelUsername}</span> deja de usarse como
        origen de recargas. Los puntos que queden en el panel del proveedor no se tocan.
      </p>
      {state?.error && <p className="text-[11px] text-[#ffb4ab]">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-[#494454] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#cbc3d7]"
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab] disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Retirando…" : "Confirmar"}
        </button>
      </div>
    </form>
  );
}
