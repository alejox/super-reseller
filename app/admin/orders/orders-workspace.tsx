import { Suspense } from "react";
import Link from "next/link";
import {
  Landmark,
  CheckCircle2,
  Clock,
  Banknote,
  Calendar,
  ChevronDown,
  Search as SearchIcon,
  Copy,
  CreditCard as CreditCardIcon,
  Wallet,
  Bitcoin,
  MoreVertical,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  TrendingUp as TrendingUpIcon,
  Server
} from "lucide-react";

import { adminOrdersDeps } from "./admin-orders";
import { formatMoney, money } from "@/shared/money/money";
import { AutoDeliverForm } from "./auto-deliver-form";

export async function OrdersWorkspace() {
  const deps = await adminOrdersDeps();
  const views = await deps.ordering.listOrders();

  // Basic stats
  const successfulViews = views.filter(v => v.order.status === "FULFILLED");
  const pendingViews = views.filter(v => v.order.status === "PENDING" || v.order.status === "AWAITING_PAYMENT");
  const totalVolumeMinor = successfulViews.reduce((acc, v) => acc + v.amountMinor, 0);

  // Assuming WALLET_CURRENCY or similar, defaulting to 'COP' for now as seen in other modules
  // but let's use the currency from the view if available.
  const mainCurrency = views[0]?.currency ?? "COP";

  return (
    <div className="w-full max-w-[1440px] mx-auto p-10 flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold text-[#dae2fd]">Historial de Transacciones</h2>
        <p className="text-base text-[#cbc3d7]">Revisa y administra las actividades financieras a lo largo de tu red de revendedores.</p>
      </div>

      {/* Summary Cards (Bento Grid Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#444173]/20 border-t border-[#4cd7f6]/30 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Volumen Total (Exitoso)</span>
            <Landmark className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">
            {formatMoney(money(totalVolumeMinor, mainCurrency), "es-CO")}
          </div>
          <div className="text-sm text-[#4cd7f6] flex items-center gap-2">
            <TrendingUpIcon className="w-4 h-4" /> Calculado en tiempo real
          </div>
        </div>

        <div className="bg-[#171f33] border-t border-[#494454]/30 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Transacciones Exitosas</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">{successfulViews.length}</div>
          <div className="text-sm text-[#cbc3d7] flex items-center gap-2">
            {views.length > 0 ? Math.round((successfulViews.length / views.length) * 100) : 0}% tasa de éxito
          </div>
        </div>

        <div className="bg-[#171f33] border-t border-[#494454]/30 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Acciones Pendientes</span>
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">{pendingViews.length}</div>
          <div className="text-sm text-[#ffb4ab] flex items-center gap-2">
            Órdenes en proceso
          </div>
        </div>

        <div className="bg-[#171f33] border-t border-[#494454]/30 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Órdenes</span>
            <Banknote className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-[#dae2fd]">{views.length}</div>
          <div className="text-sm text-[#cbc3d7] flex items-center gap-2">
            Registradas en el sistema
          </div>
        </div>
      </div>

      {/* Transaction Table Container */}
      <div className="bg-[#171f33] border border-[#494454] rounded-xl flex flex-col overflow-hidden">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-[#494454] flex flex-col lg:flex-row justify-between gap-4 items-center bg-[#131b2e]">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="bg-[#0b1326] border border-[#494454] rounded-md px-4 py-2 flex items-center gap-2 cursor-pointer hover:border-[#d0bcff] transition-colors">
              <Calendar className="w-4 h-4 text-[#cbc3d7]" />
              <span className="text-sm text-[#cbc3d7]">Últimos 30 Días</span>
              <ChevronDown className="w-4 h-4 text-[#cbc3d7]" />
            </div>
            <div className="bg-[#0b1326] border border-[#494454] rounded-md px-4 py-2 flex items-center gap-2 cursor-pointer hover:border-[#d0bcff] transition-colors">
              <span className="text-sm text-[#cbc3d7]">Método: Todos</span>
              <ChevronDown className="w-4 h-4 text-[#cbc3d7]" />
            </div>
          </div>
          <div className="w-full lg:w-auto relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbc3d7] w-4 h-4" />
            <input 
              className="w-full lg:w-64 bg-[#0b1326] border border-[#494454] rounded-md pl-10 pr-4 py-2 text-sm text-[#dae2fd] placeholder-[#cbc3d7] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors" 
              placeholder="Buscar ID o Usuario..." 
              type="text" 
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#2d3449] border-b border-[#494454]">
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Fecha</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">ID de Transacción</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Servicio / Plan</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Usuario / Revendedor</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Monto</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-center">Estado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="text-sm text-[#dae2fd] divide-y divide-[#494454]/50">
              {views.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#cbc3d7]">
                    No hay transacciones registradas.
                  </td>
                </tr>
              ) : (
                views.map((view) => (
                  <tr key={view.order.id} className="hover:bg-[#2d3449]/50 transition-colors">
                    <td className="p-4 whitespace-nowrap">
                      {view.order.placedAt.toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' })} <br />
                      <span className="text-[#cbc3d7] text-[10px]">
                        {view.order.placedAt.toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[#cbc3d7]">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/orders/${view.order.id}`} className="hover:text-[#d0bcff] hover:underline transition-colors">
                          {view.order.id.split("-")[0].toUpperCase()}...
                        </Link>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-[#dae2fd]">{view.serviceName}</div>
                      <div className="text-xs text-[#cbc3d7]">{view.planName}</div>
                    </td>
                    <td className="p-4 text-[#cbc3d7]">
                      {view.resellerEmail}
                      <div className="text-[10px] text-[#958ea0] uppercase tracking-wider mt-0.5">{view.order.buyerKind}</div>
                    </td>
                    <td className="p-4 text-right font-semibold text-[#4cd7f6]">
                      {formatMoney(money(view.amountMinor, view.currency), "es-CO")}
                    </td>
                    <td className="p-4 text-center">
                      {view.order.status === "FULFILLED" && (
                        <span className="inline-block px-2 py-1 rounded bg-[#009eb9]/20 text-[#4cd7f6] border border-[#4cd7f6]/30 text-[10px] uppercase font-bold tracking-wider">
                          Completado
                        </span>
                      )}
                      {view.order.status === "PENDING" && (
                        <span className="inline-block px-2 py-1 rounded bg-[#f3ba2f]/10 text-[#f3ba2f] border border-[#f3ba2f]/30 text-[10px] uppercase font-bold tracking-wider">
                          Pendiente
                        </span>
                      )}
                      {view.order.status === "AWAITING_PAYMENT" && (
                        <span className="inline-block px-2 py-1 rounded bg-[#444173]/40 text-[#d0bcff] border border-[#d0bcff]/30 text-[10px] uppercase font-bold tracking-wider">
                          Esperando Pago
                        </span>
                      )}
                      {view.order.status === "CANCELLED" && (
                        <span className="inline-block px-2 py-1 rounded bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/30 text-[10px] uppercase font-bold tracking-wider">
                          Cancelado
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {view.order.status === "PENDING" && (
                        <AutoDeliverForm orderId={view.order.id} />
                      )}
                      <Link href={`/admin/orders/${view.order.id}`} className="text-[#cbc3d7] hover:text-[#d0bcff] transition-colors inline-block p-1">
                        <MoreVertical className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - UI only for now */}
        {views.length > 0 && (
          <div className="p-4 border-t border-[#494454] flex justify-between items-center bg-[#131b2e]">
            <span className="text-sm text-[#cbc3d7]">Mostrando {views.length} entradas</span>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-md border border-[#494454] text-[#cbc3d7] hover:bg-[#2d3449] hover:text-[#dae2fd] transition-colors disabled:opacity-50" disabled>
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button className="px-3 py-1 rounded-md bg-[#a078ff] text-[#340080] font-semibold text-sm">
                1
              </button>
              <button className="p-2 rounded-md border border-[#494454] text-[#cbc3d7] hover:bg-[#2d3449] hover:text-[#dae2fd] transition-colors disabled:opacity-50" disabled>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
