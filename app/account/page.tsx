import type { Metadata } from "next";
import { Suspense } from "react";

import { LogoutButton } from "../logout-button";
import { AccountWorkspace, AccountWorkspaceFallback } from "./account-workspace";

export const metadata: Metadata = { title: "Mi cuenta" };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Mi cuenta
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Sus cuentas de proveedor
          </h1>
        </div>
        <LogoutButton />
      </header>
      <Suspense fallback={<AccountWorkspaceFallback />}>
        <AccountWorkspace />
      </Suspense>
    </main>
  );
}
