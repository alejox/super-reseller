import { listInventory } from "./actions";
import { AccountInventoryClient } from "./inventory-client";
import { connection } from "next/server";

export async function InventoryWorkspace() {
  await connection();
  const accounts = await listInventory();
  
  return <AccountInventoryClient accounts={accounts} />;
}
