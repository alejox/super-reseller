import { getTickets } from "./actions";
import { SupportClient } from "./support-client";
import { connection } from "next/server";

export async function SupportWorkspace() {
  await connection();
  const tickets = await getTickets();
  
  return <SupportClient initialTickets={tickets} />;
}
