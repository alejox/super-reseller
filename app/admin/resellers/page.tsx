import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, UserPlus } from "lucide-react";

import { ResellersStats, ResellersStatsFallback } from "./resellers-stats";
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

      {/* Stats Row — real figures, read from the ledger. See the comment in
          `resellers-stats.tsx` for the A7 decision these replace. */}
      <Suspense fallback={<ResellersStatsFallback />}>
        <ResellersStats />
      </Suspense>

      {/* Workspace */}
      <Suspense fallback={<ResellersWorkspaceFallback />}>
        <ResellersWorkspace />
      </Suspense>
    </div>
  );
}
