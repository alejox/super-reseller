import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomerDetailWorkspace, CustomerDetailWorkspaceFallback } from "./customer-detail-workspace";

export const metadata: Metadata = { title: "Cliente" };

export default async function AdminCustomerDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Clientes
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Detalle de cliente
        </h1>
      </header>
      <Suspense fallback={<CustomerDetailWorkspaceFallback />}>
        <CustomerDetailWorkspace targetUserId={id} />
      </Suspense>
    </main>
  );
}
