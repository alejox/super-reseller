CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"duration_days" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "plan_kind_check" CHECK ("plan"."kind" IN ('SCREEN', 'FULL_ACCOUNT')),
	CONSTRAINT "plan_duration_days_check" CHECK ("plan"."duration_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_price" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"price_tier_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	CONSTRAINT "plan_price_amount_minor_check" CHECK ("plan_price"."amount_minor" >= 0),
	CONSTRAINT "plan_price_currency_check" CHECK ("plan_price"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "price_tier" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "price_tier_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "service_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_price_tier_id_price_tier_id_fk" FOREIGN KEY ("price_tier_id") REFERENCES "public"."price_tier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_identity_uniq" ON "plan" USING btree ("service_id","kind","duration_days") WHERE "plan"."retired_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_price_current_uniq" ON "plan_price" USING btree ("plan_id","price_tier_id") WHERE "plan_price"."effective_to" IS NULL;