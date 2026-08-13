import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentsWorkspace, PaymentsWorkspaceFallback } from "./payments-workspace";

export const metadata: Metadata = {
  title: "Pagos por validar",
};

export default function AdminPaymentsPage() {
  return (
    // The workspace reads the session and the database, so it renders behind a
    // Suspense boundary while the shell prerenders (`cacheComponents: true`).
    <Suspense fallback={<PaymentsWorkspaceFallback />}>
      <PaymentsWorkspace />
    </Suspense>
  );
}
