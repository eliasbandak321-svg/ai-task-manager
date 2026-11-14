CREATE TABLE "ai_spend_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"reserved_micro_usd" bigint NOT NULL,
	"cost_micro_usd" bigint,
	"input_tokens" integer,
	"output_tokens" integer,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "ai_spend_ledger_status_valid" CHECK (status in ('reserved', 'settled', 'released')),
	CONSTRAINT "ai_spend_ledger_amounts_nonnegative" CHECK ("ai_spend_ledger"."reserved_micro_usd" >= 0 and coalesce("ai_spend_ledger"."cost_micro_usd", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_spend_total" (
	"key" text PRIMARY KEY NOT NULL,
	"committed_micro_usd" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_spend_total_nonnegative" CHECK (committed_micro_usd >= 0)
);
--> statement-breakpoint
CREATE INDEX "ai_spend_ledger_created_idx" ON "ai_spend_ledger" USING btree ("created_at");