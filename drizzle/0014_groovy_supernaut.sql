CREATE TABLE "withdrawal_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reseller_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"status" text NOT NULL,
	"wallet_entry_id" uuid NOT NULL,
	"reversal_entry_id" uuid,
	"requested_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"requested_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "withdrawal_request_status_check" CHECK ("withdrawal_request"."status" IN ('PENDING_REVIEW', 'APPROVED', 'PAID', 'REJECTED')),
	CONSTRAINT "withdrawal_request_amount_minor_check" CHECK ("withdrawal_request"."amount_minor" > 0),
	CONSTRAINT "withdrawal_request_currency_check" CHECK ("withdrawal_request"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "withdrawal_request_reversal_check" CHECK (("withdrawal_request"."status" = 'REJECTED') = ("withdrawal_request"."reversal_entry_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD CONSTRAINT "withdrawal_request_method_id_withdrawal_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."withdrawal_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD CONSTRAINT "withdrawal_request_wallet_entry_id_wallet_entry_id_fk" FOREIGN KEY ("wallet_entry_id") REFERENCES "public"."wallet_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD CONSTRAINT "withdrawal_request_reversal_entry_id_wallet_entry_id_fk" FOREIGN KEY ("reversal_entry_id") REFERENCES "public"."wallet_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD CONSTRAINT "withdrawal_request_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD CONSTRAINT "withdrawal_request_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "withdrawal_request_reseller_idx" ON "withdrawal_request" USING btree ("reseller_id","requested_at");