CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_inbox" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "project_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "project_name_length" CHECK (char_length(name) between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "subtask" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "subtask_title_length" CHECK (char_length(title) between 1 and 200),
	CONSTRAINT "subtask_position_nonnegative" CHECK ("subtask"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "task_title_length" CHECK (char_length(title) between 1 and 200),
	CONSTRAINT "task_description_length" CHECK (char_length(description) <= 5000),
	CONSTRAINT "task_status_valid" CHECK (status in ('todo', 'in_progress', 'done')),
	CONSTRAINT "task_priority_valid" CHECK (priority in ('low', 'medium', 'high')),
	CONSTRAINT "task_completed_at_matches_status" CHECK (("task"."status" = 'done') = ("task"."completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask" ADD CONSTRAINT "subtask_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask" ADD CONSTRAINT "subtask_task_same_user_fk" FOREIGN KEY ("task_id","user_id") REFERENCES "public"."task"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_same_user_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "public"."project"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_user_name_unique" ON "project" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "project_one_inbox_per_user" ON "project" USING btree ("user_id") WHERE "project"."is_inbox";--> statement-breakpoint
CREATE INDEX "subtask_user_task_idx" ON "subtask" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "task_user_project_idx" ON "task" USING btree ("user_id","project_id");