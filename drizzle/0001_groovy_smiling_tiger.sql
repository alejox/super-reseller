CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'RESELLER');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"reseller_id" uuid,
	"price_tier_id" uuid,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('ADMIN', 'RESELLER')),
	CONSTRAINT "users_reseller_requires_tier" CHECK (("users"."role" = 'RESELLER' AND "users"."price_tier_id" IS NOT NULL) OR ("users"."role" = 'ADMIN' AND "users"."price_tier_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_price_tier_id_price_tier_id_fk" FOREIGN KEY ("price_tier_id") REFERENCES "public"."price_tier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uniq" ON "users" USING btree (lower("email"));