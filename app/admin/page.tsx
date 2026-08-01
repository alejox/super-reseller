import type { Metadata } from "next";
import { Suspense } from "react";

import { requireRole } from "@/modules/identity/application/dal";
import { LogoutButton } from "../logout-button";
import { PanelField, PanelGrid, PanelSkeleton } from "../session-panel";

export const metadata: Metadata = {
  title: "Administración",
};

/**
 * Reads the session, so it MUST live inside a `<Suspense>` boundary: with
 * Cache Components enabled, runtime data accessed in the page body blocks
 * the whole route from prerendering (Next's `blocking-route` error).
 *
 * `requireRole` re-verifies against the database on every request and
 * redirects a non-ADMIN away — independently of the optimistic check
 * `proxy.ts` already made.
 */
async function AdminSession() {
  const session = await requireRole("ADMIN");

  return (
    <PanelGrid>
      <PanelField label="Rol" value={session.role} />
      <PanelField label="Sesión" value={session.sessionId} />
    </PanelGrid>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Administración
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sesión verificada contra la base de datos en cada solicitud.
          </p>
        </div>
        <LogoutButton />
      </header>

      <Suspense fallback={<PanelSkeleton />}>
        <AdminSession />
      </Suspense>
    </main>
  );
}
