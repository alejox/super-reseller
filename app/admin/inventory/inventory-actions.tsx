"use client";

import { useState } from "react";
import { Plus, UploadCloud, X, Download } from "lucide-react";
import { useRouter } from "next/navigation";

export function InventoryActions({ services }: { services: readonly { id: string, name: string }[] }) {
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const { createManualAccount } = await import('./actions');
      await createManualAccount(formData);
      setIsManualModalOpen(false);
      router.refresh();
    } catch (err) {
      alert("Error creating account");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button 
        onClick={() => setIsBulkModalOpen(true)}
        className="px-6 py-3 rounded-lg border border-[#d0bcff] text-[#d0bcff] text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-[#d0bcff]/10 transition-colors active:scale-95"
      >
        <UploadCloud className="h-5 w-5" />
        Carga Masiva
      </button>
      
      <button 
        onClick={() => setIsManualModalOpen(true)}
        className="bg-gradient-to-r from-[#d0bcff] to-[#e9ddff] px-6 py-3 rounded-lg text-[#3c0091] text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] hover:opacity-90 transition-opacity active:scale-95"
      >
        <Plus className="h-5 w-5" />
        Add Inventory
      </button>

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1326]/80 backdrop-blur-sm">
          <div className="bg-[#171f33] border border-[#494454] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#494454] flex justify-between items-center bg-[#222a3d]">
              <h3 className="text-2xl font-semibold text-[#dae2fd]">Carga Masiva de Cuentas</h3>
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="text-[#cbc3d7] hover:text-[#dae2fd] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-6 space-y-6 text-left">
              {/* Drag & Drop Zone */}
              <div className="border-2 border-dashed border-[#494454] rounded-xl p-8 flex flex-col items-center justify-center bg-[#131b2e] hover:border-[#d0bcff]/50 transition-colors cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-[#d0bcff]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="text-[#d0bcff] w-10 h-10" />
                </div>
                <p className="text-base text-[#dae2fd] mb-1">Arrastra y suelta tu archivo CSV o Excel</p>
                <p className="text-sm text-[#cbc3d7]">o haz clic para buscar en tu equipo</p>
              </div>
              {/* Template Link */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#cbc3d7]">¿No tienes el formato?</span>
                <a className="text-[#d0bcff] text-xs font-bold tracking-wider flex items-center gap-1 hover:underline" href="#">
                  <Download className="w-4 h-4" />
                  Descargar plantilla CSV
                </a>
              </div>
              {/* Manual Entry */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-wider text-[#cbc3d7] uppercase">Pegar datos manualmente</label>
                <textarea 
                  className="w-full h-32 bg-[#060e20] border border-[#494454] rounded-lg p-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none resize-none" 
                  placeholder="email:password:perfil"
                ></textarea>
              </div>
            </div>
            {/* Modal Footer */}
            <div className="p-6 border-t border-[#494454] bg-[#222a3d] flex justify-end gap-4">
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="px-6 py-2 rounded-lg border border-[#494454] text-[#cbc3d7] text-xs font-bold tracking-wider hover:bg-[#2d3449] transition-colors uppercase"
              >
                Cancelar
              </button>
              <button 
                onClick={() => router.push("/admin/inventory/upload")}
                className="bg-gradient-to-r from-[#d0bcff] to-[#e9ddff] px-8 py-2 rounded-lg text-[#3c0091] text-xs font-bold tracking-wider hover:opacity-90 transition-opacity uppercase shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]"
              >
                Procesar Carga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1326]/80 backdrop-blur-sm">
          <form 
            onSubmit={handleManualSubmit}
            className="bg-[#171f33] border border-[#494454] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-[#494454] flex justify-between items-center bg-[#222a3d]">
              <h3 className="text-2xl font-semibold text-[#dae2fd]">Alta Manual</h3>
              <button 
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-[#cbc3d7] hover:text-[#dae2fd] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-wider text-[#cbc3d7] uppercase">Servicio *</label>
                <select 
                  name="serviceId" 
                  required
                  className="w-full bg-[#060e20] border border-[#494454] rounded-lg py-3 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none"
                >
                  <option value="">Selecciona un servicio...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wider text-[#cbc3d7] uppercase">Email *</label>
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    placeholder="cuenta@ejemplo.com"
                    className="w-full bg-[#060e20] border border-[#494454] rounded-lg py-3 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wider text-[#cbc3d7] uppercase">Contraseña *</label>
                  <input 
                    name="password" 
                    type="text" 
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#060e20] border border-[#494454] rounded-lg py-3 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wider text-[#cbc3d7] uppercase">Perfil (Opcional)</label>
                  <input 
                    name="profileSlot" 
                    type="text" 
                    placeholder="Ej: Perfil 1 o PIN"
                    className="w-full bg-[#060e20] border border-[#494454] rounded-lg py-3 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wider text-[#cbc3d7] uppercase">Vencimiento (Opcional)</label>
                  <input 
                    name="expiresAt" 
                    type="date"
                    className="w-full bg-[#060e20] border border-[#494454] rounded-lg py-3 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none" 
                  />
                </div>
              </div>
            </div>
            {/* Modal Footer */}
            <div className="p-6 border-t border-[#494454] bg-[#222a3d] flex justify-end gap-4">
              <button 
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-6 py-2 rounded-lg border border-[#494454] text-[#cbc3d7] text-xs font-bold tracking-wider hover:bg-[#2d3449] transition-colors uppercase"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#d0bcff] to-[#e9ddff] px-8 py-2 rounded-lg text-[#3c0091] text-xs font-bold tracking-wider hover:opacity-90 transition-opacity uppercase shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] disabled:opacity-50"
              >
                {isSubmitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
