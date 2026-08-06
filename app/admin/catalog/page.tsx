import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminCatalogHeader } from "../admin-views";
import { CatalogWorkspace, CatalogWorkspaceFallback } from "./catalog-workspace";

export const metadata: Metadata = { title: "Gestión del catálogo" };

/**
 * The header is static and prerenders; everything that reads the session or
 * the database sits inside the Suspense boundary, which is what
 * `cacheComponents: true` requires and what makes this route Partial
 * Prerendered rather than fully dynamic.
 */
export default function AdminCatalogPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <AdminCatalogHeader />
      <Suspense fallback={<CatalogWorkspaceFallback />}>
        <CatalogWorkspace />
      </Suspense>
    </main>
  );
}
