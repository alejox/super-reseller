import { listInventory, getServicesForInventory } from "./actions";
import { AccountInventoryClient } from "./inventory-client";
import { connection } from "next/server";

export async function InventoryWorkspace() {
  await connection();
  const [accounts, services] = await Promise.all([
    listInventory(),
    getServicesForInventory()
  ]);
  
  return <AccountInventoryClient accounts={accounts} services={services} />;
}
