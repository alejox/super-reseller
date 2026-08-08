"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  FastForward, 
  Mail, 
  Copy, 
  Edit, 
  Trash2, 
  CloudUpload,
  RefreshCw,
  Check,
  X,
  ArrowRight,
  User as UserIcon
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importProviderAccountsAction } from "./actions";

type Customer = { id: string; email: string };
type Service = { id: string; name: string; slug: string };

type BulkUploadValidationClientProps = {
  customers: Customer[];
  services: Service[];
};

export default function BulkUploadValidationClient({ customers, services }: BulkUploadValidationClientProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [editingRowId, setEditingRowId] = useState<string | null>("42");
  const [resolvedRows, setResolvedRows] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: any[] } | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Simulate validation delay for demonstration
    const timer = setTimeout(() => {
      setIsValidating(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleResolve = (id: string) => {
    if (!resolvedRows.includes(id)) {
      setResolvedRows([...resolvedRows, id]);
    }
    setEditingRowId(null);
  };

  const validCount = 142 + resolvedRows.length;
  const errorCount = 8 - resolvedRows.length;

  const handleImport = async () => {
    if (!selectedCustomerId) {
      alert("Por favor selecciona un cliente primero.");
      return;
    }
    setIsSubmitting(true);
    
    // We construct some valid rows mapping to the actual database services
    // Since this is a demo/mock UI, we will take the first service available
    // and create a few provider accounts for it based on the valid count.
    // In a real app, the CSV would be parsed here.
    const serviceId = services[0]?.id;
    if (!serviceId) {
      alert("No hay servicios configurados en el sistema.");
      setIsSubmitting(false);
      return;
    }

    // Prepare exactly 2 real inserts to test the DB connection instead of 150 (to not spam the DB)
    const mockRows = [
      { serviceId, panelUsername: "j.doe@example.com", label: "Importado Masivamente 1" },
      { serviceId, panelUsername: "m.smith@stream.net", label: "Importado Masivamente 2" }
    ];

    try {
      const result = await importProviderAccountsAction(selectedCustomerId, mockRows);
      setImportResult(result);
      setIsSuccess(true);
    } catch (e) {
      alert("Error during import");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0b1326] flex items-center justify-center p-10 overflow-hidden">
        {/* Ambient glow effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-96 h-96 bg-[#d0bcff]/20 rounded-full blur-[100px]"></div>
        </div>
        
        <div className="w-full max-w-2xl bg-[#171f33] rounded-xl border border-[#2d3449] shadow-2xl relative z-10 flex flex-col items-center p-12 overflow-hidden backdrop-blur-sm animate-in zoom-in-95 duration-300">
          {/* Success Icon */}
          <div className="w-24 h-24 rounded-full bg-[#a078ff]/20 flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-[#d0bcff]/20 rounded-full animate-ping opacity-75"></div>
            <CheckCircle className="text-[#d0bcff] w-16 h-16" />
          </div>
          
          {/* Titles & Messaging */}
          <h1 className="text-4xl font-bold text-center text-[#dae2fd] mb-4">
            Carga Completada con Éxito
          </h1>
          <p className="text-lg text-[#cbc3d7] text-center max-w-md mx-auto mb-12">
            Se han importado {importResult?.success || 0} cuentas nuevas a tu inventario correctamente.
            {importResult?.errors.length ? ` (${importResult.errors.length} errores)` : ''}
          </p>
          
          {/* Progress Breakdown / Summary Bento Box */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Stat Card 1 */}
            <div className="bg-[#222a3d] rounded-lg p-6 border border-[#494454]/30 flex flex-col items-center">
              <div className="w-12 h-12 rounded bg-[#93000a]/30 flex items-center justify-center mb-4">
                <FileText className="text-[#ffb4ab] w-6 h-6" />
              </div>
              <span className="text-5xl font-bold text-[#dae2fd]">{importResult?.success || 0}</span>
              <span className="text-xs font-bold text-[#cbc3d7] uppercase tracking-wider mt-2">Cuentas Listas</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row w-full gap-6 justify-center mt-auto">
            <button 
              onClick={() => setIsSuccess(false)}
              className="px-8 py-4 rounded-lg bg-[#222a3d] border border-[#494454] text-[#dae2fd] text-xs font-bold hover:bg-[#2d3449] transition-colors flex items-center justify-center gap-2 uppercase"
            >
              <FileText className="w-5 h-5" />
              Ver Detalles de Carga
            </button>
            <button 
              onClick={() => router.push('/admin/inventory')}
              className="px-8 py-4 rounded-lg bg-gradient-to-b from-[#d0bcff] to-[#5b32a8] text-[#3c0091] text-xs font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] transition-all flex items-center justify-center gap-2 uppercase"
            >
              Volver al Inventario
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-10 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#dae2fd] mb-2">Bulk Account Upload</h1>
        <p className="text-base text-[#cbc3d7]">Validating uploaded dataset: batch_reseller_q3.csv</p>
      </div>

      {isValidating ? (
        /* State 1: Validation Progress */
        <div className="bg-[#444173] rounded-xl p-8 border border-[#494454]/30 relative overflow-hidden animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#d0bcff]/5 opacity-50"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
              <RefreshCw className="animate-spin text-[#d0bcff] w-6 h-6" />
              Validating Accounts...
            </h2>
            <p className="text-sm text-[#cbc3d7] mb-6">Analyzing records against network policies.</p>
            <div className="w-full h-2 bg-[#2d3449] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full w-3/4"
                style={{
                  background: 'linear-gradient(90deg, #d0bcff 0%, #a078ff 50%, #d0bcff 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'moveProgress 2s linear infinite'
                }}
              ></div>
            </div>
            <div className="mt-2 text-right text-xs font-bold text-[#d0bcff]">75% Complete</div>
          </div>
        </div>
      ) : (
        /* State 2: Results Summary */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Customer Assignment Section */}
          <div className="bg-[#171f33] rounded-xl border border-[#4cd7f6]/50 p-6 mb-8 flex flex-col md:flex-row gap-6 items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-[#4cd7f6]" />
                Asignar al Cliente
              </h3>
              <p className="text-sm text-[#cbc3d7]">Selecciona a qué cliente (Customer) le pertenecen estos identificadores de proveedor.</p>
            </div>
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-[#0b1326] border border-[#494454] rounded-md px-4 py-2 text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none min-w-[250px]"
            >
              {customers.length === 0 && <option value="" disabled>No hay clientes disponibles</option>}
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.email}</option>
              ))}
            </select>
          </div>

          {/* Summary Cards Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#171f33] rounded-lg p-6 border-t border-[#4cd7f6]/30 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <span className="text-[#4cd7f6] text-xs font-bold uppercase tracking-wider">Total Processed</span>
                <FileText className="text-[#cbc3d7] opacity-50 w-5 h-5" />
              </div>
              <div className="text-5xl font-bold text-[#dae2fd]">150</div>
            </div>
            
            <div className="bg-[#171f33] rounded-lg p-6 border-t border-[#d0bcff]/30 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4">
                <CheckCircle className="w-32 h-32 text-[#d0bcff]" />
              </div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <span className="text-[#d0bcff] text-xs font-bold uppercase tracking-wider">Valid Accounts</span>
                <CheckCircle className="text-[#d0bcff] w-5 h-5" />
              </div>
              <div className="text-5xl font-bold text-[#dae2fd] relative z-10">{validCount}</div>
            </div>
            
            <div className="bg-[#171f33] rounded-lg p-6 border-t border-[#ffb4ab]/50 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4">
                <AlertTriangle className="w-32 h-32 text-[#ffb4ab]" />
              </div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <span className="text-[#ffb4ab] text-xs font-bold uppercase tracking-wider">Errors Found</span>
                <AlertCircle className="text-[#ffb4ab] w-5 h-5" />
              </div>
              <div className="text-5xl font-bold text-[#ffb4ab] relative z-10">{errorCount}</div>
              {errorCount > 0 && (
                <div className="mt-2 text-[#ffdad6] bg-[#ffb4ab]/10 px-2 py-1 rounded text-xs font-bold inline-block">Action Required</div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center bg-[#131b2e] p-6 rounded-xl border border-[#494454]/50">
            <div className="text-sm text-[#cbc3d7]">
              Ready to import <strong className="text-[#d0bcff]">{validCount}</strong> valid identifiers.
            </div>
            <div className="flex gap-4">
              <Link href="/admin/inventory" className="px-8 py-2 rounded border border-[#958ea0] text-[#dae2fd] text-xs font-bold uppercase hover:bg-[#2d3449] transition-colors">
                Cancel
              </Link>
              <button 
                disabled={isSubmitting || !selectedCustomerId}
                onClick={handleImport}
                className="px-8 py-2 rounded bg-gradient-to-b from-[#d0bcff] to-[#8B5CF6] text-[#3c0091] text-xs font-bold uppercase shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <CloudUpload className="w-5 h-5" />
                )}
                Confirm and Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for the animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes moveProgress {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}} />
    </div>
  );
}
