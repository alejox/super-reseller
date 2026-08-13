import type { Metadata } from "next";
import { Suspense } from "react";

import {
  SourceAccountsWorkspace,
  SourceAccountsWorkspaceFallback,
} from "./source-accounts-workspace";

export const metadata: Metadata = {
  title: "Cuentas fuente",
};

export default function AdminSourceAccountsPage() {
  return (
    // The workspace reads the session and the database, so it renders behind a
    // Suspense boundary while the shell prerenders (`cacheComponents: true`).
    <Suspense fallback={<SourceAccountsWorkspaceFallback />}>
      <SourceAccountsWorkspace />
    </Suspense>
  );
}
