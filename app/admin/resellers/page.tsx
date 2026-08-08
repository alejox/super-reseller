import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, UserPlus, Star, Network, MonitorSmartphone } from "lucide-react";

import { ResellersWorkspace, ResellersWorkspaceFallback } from "./resellers-workspace";

export const metadata: Metadata = { title: "Reseller Network" };

export default function AdminResellersPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] p-10 flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#dae2fd]">
            Reseller Network
          </h1>
          <p className="mt-1 text-sm text-[#cbc3d7]">
            Administra a tus sub-revendedores y monitorea la distribución de créditos.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 rounded-lg border border-[#494454] bg-[#171f33] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#dae2fd] hover:bg-[#2d3449] transition-colors">
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#a078ff] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#3c0091] hover:opacity-90 transition-opacity shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]">
            <UserPlus className="h-4 w-4" />
            Añadir Revendedor
          </button>
        </div>
      </header>

      {/* Stats Row (Bento Grid) */}
      <section className="grid gap-6 sm:grid-cols-3">
        {/* Available Credits */}
        <div className="rounded-xl border-t border-[#4cd7f6]/30 bg-[#444173]/20 p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Créditos Disponibles</span>
            <Star className="w-5 h-5 text-[#d0bcff]" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">14,250</p>
          <div className="text-sm text-[#4cd7f6] flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            +1,250 este mes
          </div>
        </div>

        {/* Active Sub-Resellers */}
        <div className="rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Sub-Revendedores</span>
            <Network className="w-5 h-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">48</p>
          <div className="text-sm text-[#cbc3d7] flex items-center gap-2">
            Activos
          </div>
        </div>

        {/* Total Active Accounts */}
        <div className="rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Cuentas Activas</span>
            <MonitorSmartphone className="w-5 h-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">3,492</p>
          <div className="text-sm text-[#cbc3d7] flex items-center gap-2">
            Total en la red
          </div>
        </div>
      </section>

      {/* Workspace */}
      <Suspense fallback={<ResellersWorkspaceFallback />}>
        <ResellersWorkspace />
      </Suspense>
    </div>
  );
}
