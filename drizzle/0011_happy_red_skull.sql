CREATE TYPE "public"."inventory_status" AS ENUM('AVAILABLE', 'ASSIGNED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "inventory_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"profile_slot" text,
	"status" "inventory_status" DEFAULT 'AVAILABLE' NOT NULL,
	"assigned_to" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_accounts" ADD CONSTRAINT "inventory_accounts_reseller_id_users_id_fk" FOREIGN KEY ("reseller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_accounts" ADD CONSTRAINT "inventory_accounts_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_accounts" ADD CONSTRAINT "inventory_accounts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;