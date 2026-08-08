import { Suspense } from "react";
import { BulkUploadValidationWorkspace } from "./upload-workspace";

export const metadata = {
  title: "Validar Inventario | StreamPanel",
};

export default function BulkUploadValidationPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
          Inventario
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
          Validar cuentas subidas
        </h1>
      </header>
      <Suspense fallback={<div className="animate-pulse h-64 bg-zinc-800/40 rounded-lg p-6">Cargando dependencias...</div>}>
        <BulkUploadValidationWorkspace />
      </Suspense>
    </main>
  );
}
