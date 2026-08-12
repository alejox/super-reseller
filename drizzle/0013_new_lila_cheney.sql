CREATE TABLE "withdrawal_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_id" uuid NOT NULL,
	"type" text NOT NULL,
	"details" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawal_methods_type_check" CHECK ("withdrawal_methods"."type" IN ('BANK_TRANSFER', 'CRYPTO', 'PAYPAL'))
);
--> statement-breakpoint
CREATE TABLE "withdrawal_settings" (
	"reseller_id" uuid PRIMARY KEY NOT NULL,
	"auto_withdraw" boolean DEFAULT false NOT NULL,
	"condition" text DEFAULT 'THRESHOLD' NOT NULL,
	"threshold_amount_minor" bigint DEFAULT 5000 NOT NULL,
	"schedule_frequency" text DEFAULT 'MONTHLY' NOT NULL,
	"min_withdrawal_minor" bigint DEFAULT 5000 NOT NULL,
	"max_daily_withdrawal_minor" bigint DEFAULT 500000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawal_settings_condition_check" CHECK ("withdrawal_settings"."condition" IN ('SCHEDULED', 'THRESHOLD')),
	CONSTRAINT "withdrawal_settings_frequency_check" CHECK ("withdrawal_settings"."schedule_frequency" IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY'))
);
--> statement-breakpoint
ALTER TABLE "wallet_entry" DROP CONSTRAINT "wallet_entry_kind_check";--> statement-breakpoint
CREATE INDEX "withdrawal_methods_reseller_idx" ON "withdrawal_methods" USING btree ("reseller_id");--> statement-breakpoint
ALTER TABLE "wallet_entry" ADD CONSTRAINT "wallet_entry_kind_check" CHECK ("wallet_entry"."kind" IN ('TOPUP', 'ADJUSTMENT', 'ORDER_DEBIT', 'WITHDRAWAL'));