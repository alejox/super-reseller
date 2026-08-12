import { pgTable, text, timestamp, uuid, boolean, jsonb, bigint, pgEnum } from "drizzle-orm/pg-core";

export const gatewayEnum = pgEnum('gateway_kind', ['stripe', 'paypal', 'binance', 'mercadopago']);
export const withdrawalMethodEnum = pgEnum('withdrawal_method_kind', ['BANK', 'CRYPTO', 'PAYPAL']);
export const withdrawalConditionEnum = pgEnum('withdrawal_condition', ['SCHEDULED', 'THRESHOLD']);
export const withdrawalFrequencyEnum = pgEnum('withdrawal_frequency', ['BIWEEKLY', 'MONTHLY', 'WEEKLY']);

export const paymentGateways = pgTable('payment_gateways', {
  id: uuid('id').defaultRandom().primaryKey(),
  gateway: gatewayEnum('gateway').notNull().unique(),
  isActive: boolean('is_active').default(false).notNull(),
  config: jsonb('config').notNull().default({}),
  feePercentage: text('fee_percentage').default("0"), // store as decimal text to prevent precision loss, e.g. "2.9"
  minTopupMinor: bigint('min_topup_minor', { mode: 'number' }).notNull().default(1000), // e.g. 10.00
  maxTopupMinor: bigint('max_topup_minor', { mode: 'number' }).notNull().default(100000), // e.g. 1000.00
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const withdrawalMethods = pgTable('withdrawal_methods', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: withdrawalMethodEnum('kind').notNull(),
  name: text('name').notNull(),
  details: jsonb('details').notNull(), // { accountNumber: "...", bank: "..." } or { address: "...", network: "..." }
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const withdrawalSettings = pgTable('withdrawal_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  condition: withdrawalConditionEnum('condition').notNull().default('SCHEDULED'),
  frequency: withdrawalFrequencyEnum('frequency').notNull().default('BIWEEKLY'),
  minWithdrawalMinor: bigint('min_withdrawal_minor', { mode: 'number' }).notNull().default(5000), // 50.00
  dailyMaxMinor: bigint('daily_max_minor', { mode: 'number' }).notNull().default(500000), // 5000.00
  autoWithdrawEnabled: boolean('auto_withdraw_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PaymentGatewayRow = typeof paymentGateways.$inferSelect;
export type InsertPaymentGateway = typeof paymentGateways.$inferInsert;

export type WithdrawalMethodRow = typeof withdrawalMethods.$inferSelect;
export type InsertWithdrawalMethod = typeof withdrawalMethods.$inferInsert;

export type WithdrawalSettingsRow = typeof withdrawalSettings.$inferSelect;
export type InsertWithdrawalSettings = typeof withdrawalSettings.$inferInsert;
