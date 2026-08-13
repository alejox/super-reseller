import { CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";

import type { PaymentRequest } from "@/modules/wallet/domain/payment-request";
import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";

import { adminPaymentsDeps } from "./admin-payments";
import { METHOD_LABELS } from "./payment-labels";
import { ReviewActions } from "./review-forms";

const LOCALE = "es-CO";

function display(amountMinor: number): string {
  return formatMoney(money(amountMinor, WALLET_CURRENCY), LOCALE);
}

function displayDate(date: Date): string {
  return date.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The validation inbox (backlog A4).
 *
 * Every claim on this screen is money that has NOT been credited. The balance
 * moves when somebody presses Aprobar here, and nowhere else.
 */
export async function PaymentsWorkspace() {
  const deps = await adminPaymentsDeps();

  const [requests, users, counts] = await Promise.all([
    deps.paymentRequests.list(),
    deps.users.listUsers(),
    deps.paymentRequests.countByStatus(),
  ]);

  // A claim carries a reseller id; an operator deciding whether the money
  // arrived needs the account it belongs to.
  const emailByReseller = new Map(
    users
      .filter((user) => user.resellerId !== null)
      .map((user) => [user.resellerId as string, user.email]),
  );
  const emailByUser = new Map(users.map((user) => [user.id, user.email]));

  const pending = requests.filter((request) => request.status === "PENDING");
  const decided = requests.filter((request) => request.status !== "PENDING").slice(0, 25);

  const pendingTotal = pending.reduce((total, request) => total + request.amountMinor, 0);

  function resellerLabel(request: PaymentRequest): string {
    return emailByReseller.get(request.resellerId) ?? request.resellerId;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold text-[#dae2fd]">Pagos por validar</h2>
        <p className="max-w-3xl text-base text-[#cbc3d7]">
          Cada solicitud es un pago que un revendedor dice haber hecho. El saldo se acredita
          únicamente al aprobar, y la aprobación queda firmada con su usuario y la fecha.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-xl border-t border-[#f3ba2f]/30 bg-[#444173]/20 p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">{pending.length}</p>
          <p className="text-sm text-[#f3ba2f]">{display(pendingTotal)} sin acreditar</p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Aprobados</span>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">{counts.get("APPROVED") ?? 0}</p>
          <p className="text-sm text-[#cbc3d7]">Acreditados al saldo</p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Rechazados</span>
            <XCircle className="h-5 w-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">{counts.get("REJECTED") ?? 0}</p>
          <p className="text-sm text-[#cbc3d7]">Sin movimiento de saldo</p>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-xl border border-[#494454] bg-[#171f33]">
        <div className="border-b border-[#494454] p-6">
          <h3 className="text-xl font-semibold text-[#dae2fd]">Bandeja de validación</h3>
        </div>

        {pending.length === 0 ? (
          <p className="p-12 text-center text-sm text-[#cbc3d7]">
            No hay pagos esperando validación.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#494454] bg-[#2d3449]">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Fecha</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Revendedor</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Monto</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Medio / Referencia</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Comprobante</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Decisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#494454]/50 text-sm text-[#dae2fd]">
                {pending.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-[#2d3449]/50">
                    <td className="whitespace-nowrap p-4 text-[#cbc3d7]">
                      {displayDate(request.createdAt)}
                      <div className="mt-0.5 text-[10px] text-[#958ea0]">
                        Registrado por {emailByUser.get(request.createdBy) ?? "—"}
                      </div>
                    </td>
                    <td className="p-4 font-medium">{resellerLabel(request)}</td>
                    <td className="p-4 text-right font-semibold text-[#4cd7f6]">
                      {display(request.amountMinor)}
                    </td>
                    <td className="p-4">
                      <div className="text-[#dae2fd]">{METHOD_LABELS[request.method]}</div>
                      <div className="font-mono text-xs text-[#cbc3d7]">{request.reference}</div>
                    </td>
                    <td className="p-4">
                      <a
                        className="inline-flex items-center gap-1.5 text-xs text-[#d0bcff] transition-colors hover:underline"
                        href={request.proofUrl}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Ver comprobante
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                    <td className="p-4">
                      <ReviewActions
                        amountLabel={display(request.amountMinor)}
                        requestId={request.id}
                        resellerEmail={resellerLabel(request)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="flex flex-col overflow-hidden rounded-xl border border-[#494454] bg-[#171f33]">
          <div className="border-b border-[#494454] p-6">
            <h3 className="text-xl font-semibold text-[#dae2fd]">Decisiones recientes</h3>
            <p className="mt-1 text-sm text-[#cbc3d7]">
              Quién decidió cada pago y cuándo. Nada de esto se puede reescribir.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#494454] bg-[#2d3449]">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Decidido</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Revendedor</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Monto</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Referencia</th>
                  <th className="p-4 text-center text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Estado</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Motivo / Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#494454]/50 text-sm text-[#dae2fd]">
                {decided.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-[#2d3449]/50">
                    <td className="whitespace-nowrap p-4 text-[#cbc3d7]">
                      {request.reviewedAt ? displayDate(request.reviewedAt) : "—"}
                      <div className="mt-0.5 text-[10px] text-[#958ea0]">
                        por {request.reviewedBy ? (emailByUser.get(request.reviewedBy) ?? "—") : "—"}
                      </div>
                    </td>
                    <td className="p-4">{resellerLabel(request)}</td>
                    <td className="p-4 text-right font-semibold text-[#4cd7f6]">
                      {display(request.amountMinor)}
                    </td>
                    <td className="p-4 font-mono text-xs text-[#cbc3d7]">{request.reference}</td>
                    <td className="p-4 text-center">
                      {request.status === "APPROVED" ? (
                        <span className="inline-block rounded border border-[#4cd7f6]/30 bg-[#009eb9]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6]">
                          Aprobado
                        </span>
                      ) : (
                        <span className="inline-block rounded border border-[#ffb4ab]/30 bg-[#93000a]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab]">
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs p-4 text-xs text-[#cbc3d7]">
                      {request.decisionNote ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export function PaymentsWorkspaceFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] animate-pulse flex-col gap-8 p-10">
      <div className="h-9 w-72 rounded bg-[#2d3449]" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="h-36 rounded-xl bg-[#171f33]" />
        <div className="h-36 rounded-xl bg-[#171f33]" />
        <div className="h-36 rounded-xl bg-[#171f33]" />
      </div>
      <div className="h-64 rounded-xl bg-[#171f33]" />
    </div>
  );
}
