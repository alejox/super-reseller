import { Suspense } from "react";
import { adminInventoryDeps } from "../../admin-inventory";
import AccountDeliveryClient from "./delivery-client";
import { notFound } from "next/navigation";

export async function DeliveryWorkspace({ accountId }: { accountId: string }) {
  const deps = await adminInventoryDeps();
  const account = await deps.inventory.getAccount(accountId);

  if (!account) {
    return notFound();
  }

  return <AccountDeliveryClient account={account} />;
}
