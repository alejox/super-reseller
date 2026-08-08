"use server";

import { getDb } from "@/shared/db/client";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { DrizzleProviderAccountRepository } from "@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository";
import { createProviderAccountForCustomer } from "@/modules/provider-accounts/application/admin/create-provider-account-for-customer";

type ImportRow = {
  serviceId: string;
  panelUsername: string;
  label?: string;
};

export async function importProviderAccountsAction(
  targetCustomerId: string,
  rows: ImportRow[]
) {
  // Verificamos que el admin esté autenticado
  await requireRole("ADMIN");
  
  const scope = await getScope();
  const db = getDb();
  const repo = new DrizzleProviderAccountRepository(db, scope);

  let successCount = 0;
  let errors = [];

  for (const [index, row] of rows.entries()) {
    try {
      await createProviderAccountForCustomer(
        { providerAccounts: repo },
        targetCustomerId,
        {
          serviceId: row.serviceId,
          panelUsername: row.panelUsername,
          label: row.label,
        }
      );
      successCount++;
    } catch (e: any) {
      errors.push({ row: index + 1, error: e.message || "Unknown error" });
    }
  }

  return { success: successCount, errors };
}
