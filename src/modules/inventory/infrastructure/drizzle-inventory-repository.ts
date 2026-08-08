import { eq, and, desc, sql } from "drizzle-orm";
import type { ModuleDb } from "../../../shared/db/module-db";
import { inventoryAccounts } from "./inventory.schema";

export type InventoryAccountRow = typeof inventoryAccounts.$inferSelect;
export type InsertInventoryAccount = typeof inventoryAccounts.$inferInsert;

export interface InventoryRepository {
  listAccounts(resellerId: string): Promise<InventoryAccountRow[]>;
  createAccount(data: InsertInventoryAccount): Promise<InventoryAccountRow>;
  updateAccount(id: string, data: Partial<InsertInventoryAccount>): Promise<InventoryAccountRow | undefined>;
  getAccount(id: string): Promise<InventoryAccountRow | undefined>;
}

export class DrizzleInventoryRepository implements InventoryRepository {
  constructor(private readonly db: ModuleDb) {}

  async listAccounts(resellerId: string): Promise<InventoryAccountRow[]> {
    return await this.db
      .select()
      .from(inventoryAccounts)
      .where(eq(inventoryAccounts.resellerId, resellerId))
      .orderBy(desc(inventoryAccounts.createdAt));
  }

  async createAccount(data: InsertInventoryAccount): Promise<InventoryAccountRow> {
    const [inserted] = await this.db
      .insert(inventoryAccounts)
      .values(data)
      .returning();
    return inserted;
  }

  async updateAccount(
    id: string,
    data: Partial<InsertInventoryAccount>
  ): Promise<InventoryAccountRow | undefined> {
    const [updated] = await this.db
      .update(inventoryAccounts)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(inventoryAccounts.id, id))
      .returning();
    return updated;
  }

  async getAccount(id: string): Promise<InventoryAccountRow | undefined> {
    const [row] = await this.db
      .select()
      .from(inventoryAccounts)
      .where(eq(inventoryAccounts.id, id));
    return row;
  }
}
