import { Suspense } from "react";
import { OrdersWorkspace } from "./orders-workspace";

export const metadata = {
  title: "Historial de Transacciones",
};

export default function TransactionHistoryPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-zinc-800/40 rounded-lg p-6">Cargando transacciones...</div>}>
      <OrdersWorkspace />
    </Suspense>
  );
}
