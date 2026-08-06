CREATE TABLE "sales_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reseller_id" uuid NOT NULL,
	"placed_by" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_price_id" uuid NOT NULL,
	"wallet_entry_id" uuid NOT NULL,
	"status" text NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "sales_order_wallet_entry_id_unique" UNIQUE("wallet_entry_id"),
	CONSTRAINT "sales_order_status_check" CHECK ("sales_order"."status" IN ('PENDING', 'FULFILLED', 'CANCELLED')),
	CONSTRAINT "sales_order_fulfilled_at_check" CHECK (("sales_order"."status" = 'FULFILLED' AND "sales_order"."fulfilled_at" IS NOT NULL) OR ("sales_order"."status" <> 'FULFILLED' AND "sales_order"."fulfilled_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "wallet_entry" DROP CONSTRAINT "wallet_entry_kind_check";--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_placed_by_users_id_fk" FOREIGN KEY ("placed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_plan_price_id_plan_price_id_fk" FOREIGN KEY ("plan_price_id") REFERENCES "public"."plan_price"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_wallet_entry_id_wallet_entry_id_fk" FOREIGN KEY ("wallet_entry_id") REFERENCES "public"."wallet_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_order_reseller_idx" ON "sales_order" USING btree ("reseller_id","placed_at");--> statement-breakpoint
CREATE INDEX "sales_order_status_idx" ON "sales_order" USING btree ("status","placed_at");--> statement-breakpoint
ALTER TABLE "wallet_entry" ADD CONSTRAINT "wallet_entry_kind_check" CHECK ("wallet_entry"."kind" IN ('TOPUP', 'ADJUSTMENT', 'ORDER_DEBIT'));--> statement-breakpoint
-- Hand-added, as 0005 established for every new table. 0004's
-- ALTER DEFAULT PRIVILEGES stops a fresh table from receiving anon GRANTs,
-- but RLS is per-table state that a newly created table does not inherit,
-- and drizzle-kit will never emit this line.
ALTER TABLE "sales_order" ENABLE ROW LEVEL SECURITY;
