"use client";

import { useActionState, useState } from "react";

import { approvePaymentAction, rejectPaymentAction } from "./actions";

/**
 * The two decision buttons for one claim.
 *
 * Approving asks for confirmation the same way the claim itself did, and for
 * the same reason: this click is the one that actually moves money. Rejecting
 * cannot submit without a reason — the field is required here AND in the use
 * case AND in a database CHECK, because the reseller is going to ask why.
 */
export function ReviewActions({
  requestId,
  resellerEmail,
  amountLabel,
}: Readonly<{ requestId: string; resellerEmail: string; amountLabel: string }>) {
  const [approveState, approve, approving] = useActionState(approvePaymentAction, undefined);
  const [rejectState, reject, rejecting] = useActionState(rejectPaymentAction, undefined);

  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [reason, setReason] = useState("");

  const busy = approving || rejecting;
  const error = approveState?.error ?? rejectState?.error;

  return (
    <div className="flex flex-col items-end gap-2">
      {mode === "idle" && (
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-[#4cd7f6]/30 bg-[#009eb9]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6] transition-colors hover:bg-[#009eb9]/30"
            onClick={() => setMode("approve")}
            type="button"
          >
            Aprobar
          </button>
          <button
            className="rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab] transition-colors hover:bg-[#93000a]/30"
            onClick={() => setMode("reject")}
            type="button"
          >
            Rechazar
          </button>
        </div>
      )}

      {mode === "approve" && (
        <form action={approve} className="flex flex-col items-end gap-2">
          <input name="requestId" type="hidden" value={requestId} />
          <p className="max-w-xs text-right text-[11px] leading-4 text-[#cbc3d7]">
            Se acreditarán <span className="font-semibold text-[#4cd7f6]">{amountLabel}</span> a{" "}
            <span className="font-semibold text-[#dae2fd]">{resellerEmail}</span>. Esta acción no se
            puede deshacer.
          </p>
          <input
            aria-label="Nota de aprobación (opcional)"
            className="w-56 rounded-md border border-[#494454] bg-[#0b1326] px-3 py-1.5 text-xs text-[#dae2fd] placeholder-[#958ea0] focus:border-[#d0bcff] focus:outline-none focus:ring-1 focus:ring-[#d0bcff]"
            name="note"
            placeholder="Nota (opcional)"
            type="text"
          />
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-[#494454] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#dae2fd] transition-colors hover:bg-[#2d3449]"
              disabled={busy}
              onClick={() => setMode("idle")}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-md bg-gradient-to-r from-[#d0bcff] to-[#a078ff] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#3c0091] transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              {approving ? "Acreditando…" : "Confirmar acreditación"}
            </button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <form action={reject} className="flex flex-col items-end gap-2">
          <input name="requestId" type="hidden" value={requestId} />
          <input
            aria-label="Motivo del rechazo"
            className="w-56 rounded-md border border-[#494454] bg-[#0b1326] px-3 py-1.5 text-xs text-[#dae2fd] placeholder-[#958ea0] focus:border-[#ffb4ab] focus:outline-none focus:ring-1 focus:ring-[#ffb4ab]"
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo del rechazo"
            required
            type="text"
            value={reason}
          />
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-[#494454] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#dae2fd] transition-colors hover:bg-[#2d3449]"
              disabled={busy}
              onClick={() => setMode("idle")}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/30 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab] transition-colors hover:bg-[#93000a]/50 disabled:opacity-50"
              disabled={busy || reason.trim() === ""}
              type="submit"
            >
              {rejecting ? "Rechazando…" : "Confirmar rechazo"}
            </button>
          </div>
        </form>
      )}

      {error !== undefined && (
        <p className="max-w-xs text-right text-[11px] font-medium text-[#ffb4ab]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
