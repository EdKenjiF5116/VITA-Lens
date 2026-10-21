import { pgTable, text, integer, doublePrecision, timestamp, jsonb, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj"),
  sector: text("sector"),
  sites: integer("sites"),
  region: text("region"),
  criticality: text("criticality"),
  salesOwner: text("sales_owner"),
  technicalOwner: text("technical_owner"),
  contact: text("contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyses = pgTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("DRAFT"),
    renewalDate: text("renewal_date"),
    proposalDue: text("proposal_due"),
    termMonths: integer("term_months").notNull().default(36),
    objective: text("objective"),
    distributor: text("distributor"),
    budget: text("budget"),
    owner: text("owner"),
    notes: text("notes"),
    declaredFamilies: jsonb("declared_families").$type<string[]>().notNull().default([]),
    prices: jsonb("prices").$type<Record<string, number>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analyses_client_idx").on(t.clientId)],
);

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    rawSku: text("raw_sku").notNull(),
    rawDescription: text("raw_description"),
    quantity: doublePrecision("quantity").notNull(),
    serial: text("serial"),
    contractNumber: text("contract_number"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    unitPrice: doublePrecision("unit_price"),
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    overrideSku: text("override_sku"),
    ignored: boolean("ignored").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("items_analysis_idx").on(t.analysisId)],
);

export const answers = pgTable(
  "answers",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    familyId: text("family_id").notNull(),
    model: text("model").notNull().default(""),
    questionKey: text("question_key").notNull(),
    value: text("value").notNull(),
    origin: text("origin").notNull(),
    evidence: text("evidence"),
    author: text("author"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("answers_unique").on(t.analysisId, t.familyId, t.model, t.questionKey)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    findingKey: text("finding_key").notNull(),
    decision: text("decision").notNull(),
    comment: text("comment"),
    reviewer: text("reviewer"),
    findingHash: text("finding_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_unique").on(t.analysisId, t.findingKey)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id"),
    action: text("action").notNull(),
    detail: text("detail"),
    actor: text("actor"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_analysis_idx").on(t.analysisId)],
);

export type ClientRow = typeof clients.$inferSelect;
export type AnalysisRow = typeof analyses.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
