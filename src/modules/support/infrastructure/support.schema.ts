import { pgTable, text, timestamp, uuid, pgEnum, boolean } from "drizzle-orm/pg-core";
import { users } from "../../identity/infrastructure/identity.schema";

export const ticketStatusEnum = pgEnum('ticket_status', ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  
  subject: text('subject').notNull(),
  status: ticketStatusEnum('status').notNull().default('OPEN'),
  priority: ticketPriorityEnum('priority').notNull().default('NORMAL'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  
  content: text('content').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
