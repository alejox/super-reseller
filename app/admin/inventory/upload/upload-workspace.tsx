import "server-only";

import { adminResellerDeps } from "../../resellers/admin-resellers";
import BulkUploadValidationClient from "./upload-client";

import { connection } from "next/server";

export async function BulkUploadValidationWorkspace() {
  const deps = await adminResellerDeps();
  
  const [allUsers, services] = await Promise.all([
    deps.users.listUsers(),
    deps.catalog.listServices(),
  ]);

  const customers = allUsers.filter(u => u.role === "CUSTOMER").map(c => ({
    id: c.id,
    email: c.email
  }));

  const availableServices = services.map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug
  }));

  return (
    <BulkUploadValidationClient 
      customers={customers} 
      services={availableServices} 
    />
  );
}
