import type { Metadata } from "next";
import { Suspense } from "react";

import { requireRole } from "@/modules/identity/application/dal";
import { AdminCatalogView } from "../admin-views";

export const metadata: Metadata = { title: "Gestión del catálogo" };

async function AdminAccessStatus() {
  await requireRole("ADMIN");
  return <p className="sr-only">Acceso de administración verificado</p>;
}

export default function AdminCatalogPage() {
  return <><AdminCatalogView /><Suspense fallback={null}><AdminAccessStatus /></Suspense></>;
}
