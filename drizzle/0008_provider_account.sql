CREATE TABLE "provider_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reseller_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"panel_username" text NOT NULL,
	"label" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "provider_account_panel_username_check" CHECK (length(btrim("provider_account"."panel_username")) > 0)
);
--> statement-breakpoint
ALTER TABLE "provider_account" ADD CONSTRAINT "provider_account_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_account" ADD CONSTRAINT "provider_account_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_account_tenant_idx" ON "provider_account" USING btree ("reseller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_account_identity_uniq" ON "provider_account" USING btree ("reseller_id","service_id",lower("panel_username")) WHERE "provider_account"."archived_at" IS NULL;--> statement-breakpoint
-- Hand-added to the generated file, and REQUIRED for every new table
-- (0004_rls_lockdown.sql closed the default Supabase exposure of the tables
-- that existed then; RLS is per-table state, so a fresh table starts with it
-- OFF regardless). drizzle-kit emits portable Postgres DDL and will never
-- add this line.
ALTER TABLE "provider_account" ENABLE ROW LEVEL SECURITY;