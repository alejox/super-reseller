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
