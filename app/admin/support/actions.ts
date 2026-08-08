"use server";

import { requireRole } from "@/modules/identity/application/dal";
import { DrizzleSupportRepository } from "@/modules/support/infrastructure/drizzle-support-repository";
import { getDb } from "@/shared/db/client";
import { revalidatePath } from "next/cache";

function getSupportRepository() {
  return new DrizzleSupportRepository(getDb());
}

export async function getTickets() {
  await requireRole("ADMIN");
  const repo = getSupportRepository();
  return await repo.listTickets();
}

export async function createTicket(subject: string, message: string, priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') {
  const session = await requireRole("ADMIN");
  const repo = getSupportRepository();
  
  await repo.createTicket({
    userId: session.userId,
    subject,
    priority,
    initialMessage: message
  });
  
  revalidatePath('/admin/support');
}
