import Link from "next/link";
import {
  Landmark,
  CheckCircle2,
  Clock,
  Banknote,
  Calendar,
  ChevronDown,
  Search as SearchIcon,
  MoreVertical,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  TrendingUp as TrendingUpIcon,
} from "lucide-react";

import { formatMoney, money } from "@/shared/money/money";

import { adminOrdersDeps } from "./admin-orders";
import { AutoDeliverForm } from "./auto-deliver-form";
import { METHOD_LABELS } from "../payments/payment-labels";

/**
 * One row of the financial history, whichever table it came from.
 *
 * `kind` is not decoration: it decides what the id links to and whether the
 * row can be fulfilled. An order is a purchase; a top-up is money entering the
 * platform. Flattening them into one shape here is a PRESENTATION decision —
 * see `admin-orders.ts` for why they are not merged in the database.
 */
type FinancialRow = Readonly<{
  id: string;
  kind: "ORDER" | "TOPUP";
  at: Date;
  concept: string;
  detail: string;
  party: string;
  amountMinor: number;
  currency: string;
  status: "FULFILLED" | "PENDING" | "AWAITING_PAYMENT" | "CANCELLED" | "CREDITED";
  href: string;
  /** Only a PENDING order can be auto-delivered. */
  fulfilable: boolean;
}>;

const LOCALE = "es-CO";

export async function OrdersWorkspace() {
  const deps = await adminOrdersDeps();

  const [views, approvedTopUps, pendingTopUps, users] = await Promise.all([
    deps.ordering.listOrders(),
    deps.paymentRequests.list("APPROVED"),
    deps.paymentRequests.list("PENDING"),
    deps.users.listUsers(),
  ]);

  const emailByReseller = new Map(
    users
      .filter((user) => user.resellerId !== null)
      .map((user) => [user.resellerId as string, user.email]),
  );

  const orderRows: FinancialRow[] = views.map((view) => ({
    id: view.order.id,
    kind: "ORDER",
    at: view.order.placedAt,
    concept: view.serviceName,
    detail: view.planName,
    // A CUSTOMER order carries no reseller email; the column still needs text.
    party: view.resellerEmail ?? "—",
    amountMinor: view.amountMinor,
    currency: view.currency,
    status: view.order.status as FinancialRow["status"],
    href: `/admin/orders/${view.order.id}`,
    fulfilable: view.order.status === "PENDING",
  }));

  /**
   * Backlog A6: every approved payment shows up here with its own transaction
   * id — the `payment_request.id` itself, which is also what the ledger entry
   * memo points back to. REJECTED claims are absent on purpose: this screen is
   * money that moved, and a rejection moved none.
   */
  const topUpRows: FinancialRow[] = approvedTopUps.map((request) => ({
    id: request.id,
    kind: "TOPUP",
    // The moment the money was credited, not the moment it was claimed —
    // sorted beside the orders it can now pay for.
    at: request.reviewedAt ?? request.createdAt,
    concept: "Recarga de saldo",
    detail: `${METHOD_LABELS[request.method]} · ${request.reference}`,
    party: emailByReseller.get(request.resellerId) ?? request.resellerId,
    amountMinor: request.amountMinor,
    currency: request.currency,
    status: "CREDITED",
    href: "/admin/payments",
    fulfilable: false,
  }));

  const rows = [...orderRows, ...topUpRows].sort((a, b) => b.at.getTime() - a.at.getTime());

  const salesVolumeMinor = orderRows
    .filter((row) => row.status === "FULFILLED")
    .reduce((total, row) => total + row.amountMinor, 0);
  const creditedMinor = topUpRows.reduce((total, row) => total + row.amountMinor, 0);
  const successfulCount = rows.filter(
    (row) => row.status === "FULFILLED" || row.status === "CREDITED",
  ).length;
  const pendingCount =
    orderRows.filter((row) => row.status === "PENDING" || row.status === "AWAITING_PAYMENT").length +
    pendingTopUps.length;

  const mainCurrency = rows[0]?.currency ?? "COP";

  function display(amountMinor: number, currency: string): string {
    return formatMoney(money(amountMinor, currency), LOCALE);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold text-[#dae2fd]">Historial de Transacciones</h2>
        <p className="text-base text-[#cbc3d7]">
          Ventas y recargas acreditadas, en una sola línea de tiempo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4 rounded-xl border-t border-[#4cd7f6]/30 bg-[#444173]/20 p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Volumen en Ventas</span>
            <Landmark className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">
            {display(salesVolumeMinor, mainCurrency)}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#4cd7f6]">
            <TrendingUpIcon className="h-4 w-4" /> Órdenes completadas
          </div>
        </div>

        {/* Deliberately a SEPARATE card, not added to the volume above: a
            reseller who tops up and then spends it would otherwise be counted
            twice, and the total would read as revenue it is not. */}
        <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Recargas Acreditadas</span>
            <Banknote className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">
            {display(creditedMinor, mainCurrency)}
          </div>
          <div className="text-sm text-[#cbc3d7]">{topUpRows.length} pagos aprobados</div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Transacciones Exitosas</span>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">{successfulCount}</div>
          <div className="text-sm text-[#cbc3d7]">
            {rows.length > 0 ? Math.round((successfulCount / rows.length) * 100) : 0}% del total
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Acciones Pendientes</span>
            <Clock className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">{pendingCount}</div>
          <div className="text-sm text-[#ffb4ab]">
            {pendingTopUps.length > 0 ? (
              <Link className="hover:underline" href="/admin/payments">
                {pendingTopUps.length} pago(s) por validar
              </Link>
            ) : (
              "Órdenes en proceso"
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-[#494454] bg-[#171f33]">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-[#494454] bg-[#131b2e] p-4 lg:flex-row">
          <div className="flex w-full flex-wrap items-center gap-4 lg:w-auto">
            <div className="flex cursor-pointer items-center gap-2 rounded-md border border-[#494454] bg-[#0b1326] px-4 py-2 transition-colors hover:border-[#d0bcff]">
              <Calendar className="h-4 w-4 text-[#cbc3d7]" />
              <span className="text-sm text-[#cbc3d7]">Últimos 30 Días</span>
              <ChevronDown className="h-4 w-4 text-[#cbc3d7]" />
            </div>
            <div className="flex cursor-pointer items-center gap-2 rounded-md border border-[#494454] bg-[#0b1326] px-4 py-2 transition-colors hover:border-[#d0bcff]">
              <span className="text-sm text-[#cbc3d7]">Método: Todos</span>
              <ChevronDown className="h-4 w-4 text-[#cbc3d7]" />
            </div>
          </div>
          <div className="relative w-full lg:w-auto">
            <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#cbc3d7]" />
            <input
              className="w-full rounded-md border border-[#494454] bg-[#0b1326] py-2 pl-10 pr-4 text-sm text-[#dae2fd] outline-none transition-colors placeholder-[#cbc3d7] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] lg:w-64"
              placeholder="Buscar ID o Usuario..."
              type="text"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#494454] bg-[#2d3449]">
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Fecha</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">ID de Transacción</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Tipo</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Concepto</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Usuario / Revendedor</th>
                <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Monto</th>
                <th className="p-4 text-center text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Estado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494454]/50 text-sm text-[#dae2fd]">
              {rows.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-[#cbc3d7]" colSpan={8}>
                    No hay transacciones registradas.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="transition-colors hover:bg-[#2d3449]/50">
                    <td className="whitespace-nowrap p-4">
                      {row.at.toLocaleDateString(LOCALE, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      <br />
                      <span className="text-[10px] text-[#cbc3d7]">
                        {row.at.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[#cbc3d7]">
                      <Link
                        className="transition-colors hover:text-[#d0bcff] hover:underline"
                        href={row.href}
                      >
                        {row.id.split("-")[0].toUpperCase()}...
                      </Link>
                    </td>
                    <td className="p-4">
                      {row.kind === "TOPUP" ? (
                        <span className="inline-block rounded border border-[#d0bcff]/30 bg-[#444173]/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#d0bcff]">
                          Recarga
                        </span>
                      ) : (
                        <span className="inline-block rounded border border-[#494454] bg-[#222a3d] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#cbc3d7]">
                          Venta
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-[#dae2fd]">{row.concept}</div>
                      <div className="text-xs text-[#cbc3d7]">{row.detail}</div>
                    </td>
                    <td className="p-4 text-[#cbc3d7]">{row.party}</td>
                    <td className="p-4 text-right font-semibold text-[#4cd7f6]">
                      {display(row.amountMinor, row.currency)}
                    </td>
                    <td className="p-4 text-center">
                      {row.status === "CREDITED" && (
                        <span className="inline-block rounded border border-[#4cd7f6]/30 bg-[#009eb9]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6]">
                          Acreditado
                        </span>
                      )}
                      {row.status === "FULFILLED" && (
                        <span className="inline-block rounded border border-[#4cd7f6]/30 bg-[#009eb9]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6]">
                          Completado
                        </span>
                      )}
                      {row.status === "PENDING" && (
                        <span className="inline-block rounded border border-[#f3ba2f]/30 bg-[#f3ba2f]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f3ba2f]">
                          Pendiente
                        </span>
                      )}
                      {row.status === "AWAITING_PAYMENT" && (
                        <span className="inline-block rounded border border-[#d0bcff]/30 bg-[#444173]/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#d0bcff]">
                          Esperando Pago
                        </span>
                      )}
                      {row.status === "CANCELLED" && (
                        <span className="inline-block rounded border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab]">
                          Cancelado
                        </span>
                      )}
                    </td>
                    <td className="flex items-center justify-end gap-2 p-4 text-right">
                      {row.fulfilable && <AutoDeliverForm orderId={row.id} />}
                      <Link
                        className="inline-block p-1 text-[#cbc3d7] transition-colors hover:text-[#d0bcff]"
                        href={row.href}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#494454] bg-[#131b2e] p-4">
            <span className="text-sm text-[#cbc3d7]">Mostrando {rows.length} entradas</span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-[#494454] p-2 text-[#cbc3d7] transition-colors hover:bg-[#2d3449] hover:text-[#dae2fd] disabled:opacity-50"
                disabled
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button className="rounded-md bg-[#a078ff] px-3 py-1 text-sm font-semibold text-[#340080]">
                1
              </button>
              <button
                className="rounded-md border border-[#494454] p-2 text-[#cbc3d7] transition-colors hover:bg-[#2d3449] hover:text-[#dae2fd] disabled:opacity-50"
                disabled
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
