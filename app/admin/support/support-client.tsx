"use client";

import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Search as SearchIcon,
  Filter,
  MoreVertical,
  Plus,
  Headset
} from "lucide-react";

export function SupportClient({ initialTickets }: { initialTickets: any[] }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] p-10 flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#dae2fd]">
            Soporte y Tickets
          </h1>
          <p className="mt-1 text-sm text-[#cbc3d7]">
            Gestiona las solicitudes de soporte de tus revendedores y clientes.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#a078ff] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#3c0091] hover:opacity-90 transition-opacity shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]">
            <Plus className="h-4 w-4" />
            Nuevo Ticket
          </button>
        </div>
      </header>

      {/* Stats Row (Bento Grid) */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open Tickets */}
        <div className="rounded-xl border-t border-[#4cd7f6]/30 bg-[#444173]/20 p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Tickets Abiertos</span>
            <Ticket className="w-5 h-5 text-[#d0bcff]" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">24</p>
          <div className="text-sm text-[#4cd7f6] flex items-center gap-2">
            +5 hoy
          </div>
        </div>

        {/* Urgent Tickets */}
        <div className="rounded-xl border-t border-[#ffb4ab]/30 bg-[#93000a]/10 p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Urgentes</span>
            <AlertCircle className="w-5 h-5 text-[#ffb4ab]" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">3</p>
          <div className="text-sm text-[#ffb4ab] flex items-center gap-2">
            Requieren atención inmediata
          </div>
        </div>

        {/* Average Resolution Time */}
        <div className="rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Tiempo Promedio</span>
            <Clock className="w-5 h-5 text-[#cbc3d7]" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">2.4<span className="text-xl font-normal text-[#cbc3d7] ml-1">hrs</span></p>
          <div className="text-sm text-[#cbc3d7] flex items-center gap-2">
            -15% vs mes anterior
          </div>
        </div>

        {/* Resolved Today */}
        <div className="rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Resueltos Hoy</span>
            <CheckCircle2 className="w-5 h-5 text-[#cbc3d7]" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">18</p>
          <div className="text-sm text-[#cbc3d7] flex items-center gap-2">
            92% tasa de satisfacción
          </div>
        </div>
      </section>

      {/* Tickets Table */}
      <div className="bg-[#171f33] border border-[#494454] rounded-xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-[#494454] flex flex-col lg:flex-row justify-between gap-4 items-center bg-[#131b2e]">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="bg-[#0b1326] border border-[#494454] rounded-md px-4 py-2 flex items-center gap-2 cursor-pointer hover:border-[#d0bcff] transition-colors">
              <Filter className="w-4 h-4 text-[#cbc3d7]" />
              <span className="text-sm text-[#cbc3d7]">Estado: Abiertos</span>
            </div>
            <div className="bg-[#0b1326] border border-[#494454] rounded-md px-4 py-2 flex items-center gap-2 cursor-pointer hover:border-[#d0bcff] transition-colors">
              <span className="text-sm text-[#cbc3d7]">Prioridad: Todas</span>
            </div>
          </div>
          <div className="w-full lg:w-auto relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbc3d7] w-4 h-4" />
            <input 
              className="w-full lg:w-64 bg-[#0b1326] border border-[#494454] rounded-md pl-10 pr-4 py-2 text-sm text-[#dae2fd] placeholder-[#958ea0] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors" 
              placeholder="Buscar ticket..." 
              type="text" 
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#2d3449] border-b border-[#494454]">
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Ticket</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Asunto</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Usuario</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Estado</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Prioridad</th>
                <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Actualizado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="text-sm text-[#dae2fd] divide-y divide-[#494454]/50">
              
              {initialTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#cbc3d7]">
                    No hay tickets de soporte.
                  </td>
                </tr>
              )}
              {initialTickets.map((ticket: any) => {
                let statusBadge = null;
                switch (ticket.status) {
                  case 'OPEN':
                    statusBadge = <span className="inline-block px-2 py-1 rounded bg-[#009eb9]/20 text-[#4cd7f6] border border-[#4cd7f6]/30 text-[10px] uppercase font-bold tracking-wider">Abierto</span>;
                    break;
                  case 'PENDING':
                    statusBadge = <span className="inline-block px-2 py-1 rounded bg-[#444173]/40 text-[#d0bcff] border border-[#d0bcff]/30 text-[10px] uppercase font-bold tracking-wider">Pendiente</span>;
                    break;
                  case 'RESOLVED':
                    statusBadge = <span className="inline-block px-2 py-1 rounded bg-[#131b2e] text-[#cbc3d7] border border-[#494454] text-[10px] uppercase font-bold tracking-wider">Resuelto</span>;
                    break;
                  default:
                    statusBadge = <span className="inline-block px-2 py-1 rounded bg-[#131b2e] text-[#cbc3d7] border border-[#494454] text-[10px] uppercase font-bold tracking-wider">{ticket.status}</span>;
                }

                let priorityBadge = null;
                switch (ticket.priority) {
                  case 'URGENT':
                    priorityBadge = <span className="inline-block px-2 py-1 rounded bg-[#93000a]/20 text-[#ffb4ab] border border-[#ffb4ab]/30 text-[10px] uppercase font-bold tracking-wider">Urgente</span>;
                    break;
                  case 'HIGH':
                    priorityBadge = <span className="inline-block px-2 py-1 rounded bg-[#222a3d] text-[#cbc3d7] border border-[#494454] text-[10px] uppercase font-bold tracking-wider">Alta</span>;
                    break;
                  default:
                    priorityBadge = <span className="inline-block px-2 py-1 rounded bg-[#222a3d] text-[#cbc3d7] border border-[#494454] text-[10px] uppercase font-bold tracking-wider">Normal</span>;
                }

                return (
                  <tr key={ticket.id} className="hover:bg-[#2d3449]/50 transition-colors">
                    <td className="p-4 font-mono text-[#cbc3d7] truncate max-w-[120px]">
                      #{ticket.id.split('-')[0]}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-[#dae2fd]">{ticket.subject}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{ticket.userName || "Usuario"}</div>
                    </td>
                    <td className="p-4">
                      {statusBadge}
                    </td>
                    <td className="p-4">
                      {priorityBadge}
                    </td>
                    <td className="p-4 text-right text-[#cbc3d7]">
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-[#cbc3d7] hover:text-[#d0bcff] transition-colors p-2 rounded hover:bg-[#222a3d]">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
