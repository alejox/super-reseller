"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/shared/db/client";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { createDrizzleWithdrawalRepository } from "../../infrastructure/drizzle-withdrawal-repository";
import { DrizzleWithdrawalRequestRepository } from "../../infrastructure/drizzle-withdrawal-request-repository";
import {
  getWithdrawalMethods,
  addWithdrawalMethod,
  getWithdrawalSettings,
  updateWithdrawalSettings
} from "./withdrawals";
import { requestWithdrawal, type RequestWithdrawalResult } from "./request-withdrawal";
import type {
  NewWithdrawalMethodInput,
  UpdateWithdrawalSettingsInput
} from "../../domain/withdrawal";

const getDeps = () => ({
  withdrawals: createDrizzleWithdrawalRepository(getDb()),
  resellerExists: async () => true, // En el contexto del revendedor, ya pasamos por requireRole
});

export async function fetchWithdrawalMethodsAction() {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");
  return getWithdrawalMethods(getDeps(), scope.resellerId);
}

export async function addWithdrawalMethodAction(
  type: NewWithdrawalMethodInput["type"],
  details: string,
  isPrimary: boolean
) {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");
  
  const result = await addWithdrawalMethod(getDeps(), {
    resellerId: scope.resellerId,
    type,
    details,
    isPrimary
  });

  if (!result.ok) {
    throw new Error("Reseller no encontrado"); // Imposible en teoría por requireRole
  }

  revalidatePath("/admin/settings/withdrawals");
  return result.method;
}

export async function fetchWithdrawalSettingsAction() {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");
  return getWithdrawalSettings(getDeps(), scope.resellerId);
}

export async function updateWithdrawalSettingsAction(
  input: Omit<UpdateWithdrawalSettingsInput, "resellerId">
) {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");

  const result = await updateWithdrawalSettings(getDeps(), {
    ...input,
    resellerId: scope.resellerId,
  });

  if (!result.ok) {
    throw new Error("Reseller no encontrado");
  }

  revalidatePath("/admin/settings/withdrawals");
  return result.settings;
}

/**
 * The reseller asks for money out.
 *
 * Returns the failure instead of throwing: every `ok: false` here is a
 * condition the reseller can act on — top up, raise a limit, pick another
 * method — and a thrown error would surface as a generic 500 with none of
 * that. Genuine impossibilities (no scope, no session) still throw.
 */
export async function requestWithdrawalAction(
  methodId: string,
  amountMinor: string,
): Promise<RequestWithdrawalResult> {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");

  const db = getDb();
  const result = await requestWithdrawal(
    {
      withdrawalRequests: new DrizzleWithdrawalRequestRepository(db, scope),
      withdrawals: createDrizzleWithdrawalRepository(db),
      resellerId: scope.resellerId,
      // The USER, not the reseller: `wallet_entry.created_by` and
      // `withdrawal_request.requested_by` both reference `users.id`, and a
      // ledger nobody signed cannot be audited.
      requestedBy: scope.userId,
    },
    { methodId, amountMinor },
  );

  if (result.ok) {
    revalidatePath("/admin/settings/withdrawals");
  }

  return result;
}

export async function setPrimaryMethodAction(methodId: string) {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");
  const deps = getDeps();
  
  await deps.withdrawals.setPrimaryMethod(scope.resellerId, methodId);
  revalidatePath("/admin/settings/withdrawals");
}

export async function deactivateMethodAction(methodId: string) {
  await requireRole("RESELLER");
  const scope = await getScope();
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");
  const deps = getDeps();
  
  await deps.withdrawals.deactivateMethod(scope.resellerId, methodId);
  revalidatePath("/admin/settings/withdrawals");
}
