CREATE TABLE "analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"renewal_date" text,
	"proposal_due" text,
	"term_months" integer DEFAULT 36 NOT NULL,
	"objective" text,
	"distributor" text,
	"budget" text,
	"owner" text,
	"notes" text,
	"declared_families" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"family_id" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"question_key" text NOT NULL,
	"value" text NOT NULL,
	"origin" text NOT NULL,
	"evidence" text,
	"author" text,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text,
	"action" text NOT NULL,
	"detail" text,
	"actor" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"cnpj" text,
	"sector" text,
	"sites" integer,
	"region" text,
	"criticality" text,
	"sales_owner" text,
	"technical_owner" text,
	"contact" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"raw_sku" text NOT NULL,
	"raw_description" text,
	"quantity" double precision NOT NULL,
	"serial" text,
	"contract_number" text,
	"start_date" text,
	"end_date" text,
	"unit_price" double precision,
	"source" text NOT NULL,
	"source_ref" text,
	"override_sku" text,
	"ignored" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"finding_key" text NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"reviewer" text,
	"finding_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_client_idx" ON "analyses" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_unique" ON "answers" USING btree ("analysis_id","family_id","model","question_key");--> statement-breakpoint
CREATE INDEX "audit_analysis_idx" ON "audit_log" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "items_analysis_idx" ON "items" USING btree ("analysis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_unique" ON "reviews" USING btree ("analysis_id","finding_key");