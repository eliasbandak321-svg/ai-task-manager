CREATE TABLE "task_dependency" (
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_dependency_task_id_depends_on_id_pk" PRIMARY KEY("task_id","depends_on_id"),
	CONSTRAINT "task_dependency_not_self" CHECK ("task_dependency"."task_id" <> "task_dependency"."depends_on_id")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "cost_micro_usd" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "session_status" text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_task_same_user_fk" FOREIGN KEY ("task_id","user_id") REFERENCES "public"."task"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_prerequisite_same_user_fk" FOREIGN KEY ("depends_on_id","user_id") REFERENCES "public"."task"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_dependency_user_idx" ON "task_dependency" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_session_status_valid" CHECK (session_status in ('planned', 'completed', 'skipped'));