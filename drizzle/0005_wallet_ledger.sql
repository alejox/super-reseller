CREATE TABLE "wallet_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reseller_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"memo" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "wallet_entry_kind_check" CHECK ("wallet_entry"."kind" IN ('TOPUP', 'ADJUSTMENT')),
	CONSTRAINT "wallet_entry_amount_minor_check" CHECK ("wallet_entry"."amount_minor" <> 0),
	CONSTRAINT "wallet_entry_currency_check" CHECK ("wallet_entry"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "wallet_entry" ADD CONSTRAINT "wallet_entry_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_entry_reseller_idx" ON "wallet_entry" USING btree ("reseller_id","created_at");--> statement-breakpoint
-- Hand-added to the generated file, and REQUIRED for every new table from
-- here on. 0004 revoked Supabase's default privileges so `anon` gets no
-- GRANT on a newly created table, but RLS is per-table state: a fresh table
-- starts with it OFF no matter what 0004 did to the ones that existed then.
-- drizzle-kit emits portable Postgres DDL and will never add this line.
--
-- Of every table in this schema, a wallet ledger is the one where getting it
-- wrong is worst: it is the reseller's money.
ALTER TABLE "wallet_entry" ENABLE ROW LEVEL SECURITY;