import { Suspense } from "react";

import { WithdrawalsWorkspace } from "./withdrawals-workspace";

export const metadata = {
  title: "Configuración de Retiros",
};

export default function WithdrawalsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white">Cargando configuración...</div>}>
      <WithdrawalsWorkspace />
    </Suspense>
  );
}
