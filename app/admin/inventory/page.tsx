import { Suspense } from "react";
import { InventoryWorkspace } from "./inventory-workspace";

export const metadata = {
  title: "Inventario | StreamPanel",
};

export default function AccountInventoryPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white animate-pulse">Cargando inventario...</div>}>
      <InventoryWorkspace />
    </Suspense>
  );
}
