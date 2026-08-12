"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/shared/db/client";
import { getScope, requireRole } from "@/modules/identity/application/dal";
import { DrizzleWithdrawalRequestRepository } from "../../infrastructure/drizzle-withdrawal-request-repository";
import {
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  settleWithdrawalRequest,
  type ReviewWithdrawalResult,
} from "./review-withdrawal";

/**
 * Finance-facing actions. ADMIN only — a reseller approving its own
 * withdrawal is the entire control this module exists to enforce.
 */

async function adminDeps() {
  const session = await requireRole("ADMIN");
  const scope = await getScope();

  return {
    withdrawalRequests: new DrizzleWithdrawalRequestRepository(getDb(), scope),
    actorId: session.userId,
  };
}

const REVIEW_PATH = "/admin/settings/withdrawals";

export async function fetchWithdrawalRequestsAction() {
  await requireRole("ADMIN");
  const scope = await getScope();
  return new DrizzleWithdrawalRequestRepository(getDb(), scope).listRequests();
}

export async function approveWithdrawalAction(
  requestId: string,
  note: string | null,
): Promise<ReviewWithdrawalResult> {
  const result = await approveWithdrawalRequest(await adminDeps(), { requestId, note });
  if (result.ok) revalidatePath(REVIEW_PATH);
  return result;
}

export async function rejectWithdrawalAction(
  requestId: string,
  note: string | null,
): Promise<ReviewWithdrawalResult> {
  const result = await rejectWithdrawalRequest(await adminDeps(), { requestId, note });
  if (result.ok) revalidatePath(REVIEW_PATH);
  return result;
}

/** Confirms the transfer actually left the operator's bank. */
export async function settleWithdrawalAction(
  requestId: string,
  note: string | null,
): Promise<ReviewWithdrawalResult> {
  const result = await settleWithdrawalRequest(await adminDeps(), { requestId, note });
  if (result.ok) revalidatePath(REVIEW_PATH);
  return result;
}
