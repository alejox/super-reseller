import type { Metadata } from "next";
import { Suspense } from "react";

import { requireRole } from "@/modules/identity/application/dal";
import { AdminDashboardView } from "./admin-views";

export const metadata: Metadata = {
  title: "Panel de administración",
};

async function AdminAccessStatus() {
  await requireRole("ADMIN");
  return <p className="sr-only">Acceso de administración verificado</p>;
}

export default function AdminPage() {
  return (
    <>
      <AdminDashboardView />
      <Suspense fallback={null}><AdminAccessStatus /></Suspense>
    </>
  );
}
