import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { users } from "../../identity/infrastructure/identity.schema";
import { service } from "../../catalog/infrastructure/catalog.schema";
import { providerAccount } from "../../provider-accounts/infrastructure/provider-account.schema";

export const inventoryStatusEnum = pgEnum('inventory_status', ['AVAILABLE', 'ASSIGNED', 'EXPIRED', 'CANCELLED']);

export const inventoryAccounts = pgTable('inventory_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  resellerId: uuid('reseller_id').notNull().references(() => users.id),
  serviceId: uuid('service_id').notNull().references(() => service.id),
  
  email: text('email').notNull(),
  password: text('password').notNull(),
  profileSlot: text('profile_slot'),
  
  status: inventoryStatusEnum('status').notNull().default('AVAILABLE'),
  
  assignedTo: uuid('assigned_to').references(() => users.id),
  providerAccountId: uuid('provider_account_id').references(() => providerAccount.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type InventoryAccountRow = typeof inventoryAccounts.$inferSelect;
export type InsertInventoryAccount = typeof inventoryAccounts.$inferInsert;
