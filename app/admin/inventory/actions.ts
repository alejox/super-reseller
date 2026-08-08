"use server";

import { adminInventoryDeps } from "./admin-inventory";

export async function listInventory() {
  const deps = await adminInventoryDeps();
  const [accounts, users, services] = await Promise.all([
    deps.inventory.listAccounts(deps.actorId),
    deps.users.listUsers(),
    deps.catalog.listServices(),
  ]);

  const userMap = new Map(users.map(u => [u.id, u]));
  const serviceMap = new Map(services.map(s => [s.id, s]));

  return accounts.map(acc => ({
    ...acc,
    service: serviceMap.get(acc.serviceId),
    assignedUser: acc.assignedTo ? userMap.get(acc.assignedTo) : null,
  }));
}

export async function getServicesForInventory() {
  const deps = await adminInventoryDeps();
  return deps.catalog.listServices();
}

export async function createManualAccount(formData: FormData) {
  const deps = await adminInventoryDeps();
  const serviceId = formData.get("serviceId") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const profileSlot = formData.get("profileSlot") as string | null;
  const expiresAtStr = formData.get("expiresAt") as string | null;
  
  if (!serviceId || !email || !password) {
    throw new Error("Missing required fields");
  }

  const account = await deps.inventory.createAccount({
    resellerId: deps.actorId,
    serviceId,
    email,
    password,
    profileSlot: profileSlot || null,
    expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
    status: "AVAILABLE"
  });

  return account;
}
