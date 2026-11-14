CREATE TABLE "ai_conversation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_conversation_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "ai_conversation_title_length" CHECK (char_length(title) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "ai_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"proposal_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_message_role_valid" CHECK (role in ('user', 'assistant')),
	CONSTRAINT "ai_message_content_length" CHECK (char_length(content) <= 8000)
);
--> statement-breakpoint
CREATE TABLE "ai_proposal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"source" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "ai_proposal_kind_valid" CHECK (kind in ('plan', 'schedule', 'changes')),
	CONSTRAINT "ai_proposal_status_valid" CHECK (status in ('pending', 'applied', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"task_id" uuid,
	"recurrence" jsonb,
	"excluded_starts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"series_id" uuid,
	"original_start" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "calendar_event_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "calendar_event_title_length" CHECK (char_length(title) between 1 and 200),
	CONSTRAINT "calendar_event_description_length" CHECK (char_length(description) <= 2000),
	CONSTRAINT "calendar_event_category_valid" CHECK (category in ('work_session', 'study', 'meeting', 'focus', 'personal', 'break', 'other')),
	CONSTRAINT "calendar_event_span_valid" CHECK ("calendar_event"."end_at" > "calendar_event"."start_at" and "calendar_event"."end_at" - "calendar_event"."start_at" <= interval '14 days')
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"time_zone" text NOT NULL,
	"use_case" text NOT NULL,
	"work_days" integer[] NOT NULL,
	"day_start_minutes" integer NOT NULL,
	"day_end_minutes" integer NOT NULL,
	"focus_period" text NOT NULL,
	"session_minutes" integer NOT NULL,
	"break_minutes" integer NOT NULL,
	"max_daily_minutes" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_preferences_use_case_valid" CHECK (use_case in ('student', 'developer', 'professional', 'freelancer', 'personal', 'general')),
	CONSTRAINT "user_preferences_focus_valid" CHECK (focus_period in ('morning', 'afternoon', 'evening', 'none')),
	CONSTRAINT "user_preferences_hours_valid" CHECK ("user_preferences"."day_start_minutes" >= 0 and "user_preferences"."day_end_minutes" <= 1440 and "user_preferences"."day_end_minutes" - "user_preferences"."day_start_minutes" >= 30)
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_conversation_same_user_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."ai_conversation"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposal" ADD CONSTRAINT "ai_proposal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_task_same_user_fk" FOREIGN KEY ("task_id","user_id") REFERENCES "public"."task"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_series_same_user_fk" FOREIGN KEY ("series_id","user_id") REFERENCES "public"."calendar_event"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conversation_user_idx" ON "ai_conversation" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ai_message_conversation_idx" ON "ai_message" USING btree ("user_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_proposal_user_idx" ON "ai_proposal" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "calendar_event_user_start_idx" ON "calendar_event" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "calendar_event_user_task_idx" ON "calendar_event" USING btree ("user_id","task_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_estimated_minutes_range" CHECK (estimated_minutes is null or estimated_minutes between 5 and 6000);