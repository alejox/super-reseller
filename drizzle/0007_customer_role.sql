ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_reseller_requires_tier";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('ADMIN', 'RESELLER', 'CUSTOMER'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tier_matches_role" CHECK (("users"."role" IN ('RESELLER', 'CUSTOMER') AND "users"."price_tier_id" IS NOT NULL) OR ("users"."role" = 'ADMIN' AND "users"."price_tier_id" IS NULL));
