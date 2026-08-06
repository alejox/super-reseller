import type { Metadata } from "next";
import { Suspense } from "react";

import { ResellersWorkspace, ResellersWorkspaceFallback } from "./resellers-workspace";

export const metadata: Metadata = { title: "Revendedores" };

export default function AdminResellersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Revendedores
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Gestión de revendedores
        </h1>
        <p className="max-w-2xl text-zinc-600">
          Dé de alta cuentas y asígnelas al nivel de precio que corresponda.
        </p>
      </header>
      <Suspense fallback={<ResellersWorkspaceFallback />}>
        <ResellersWorkspace />
      </Suspense>
    </main>
  );
}
