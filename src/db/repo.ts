import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import { analyses, answers, auditLog, clients, items, reviews } from "./schema";
import type { AnalysisRow, AnswerRow, ClientRow, ItemRow, ReviewRow } from "./schema";
import type { AnalysisInput, EvidenceOrigin, ReviewDecision } from "@/domain/types";
import { todayIso } from "@/lib/dates";

export const newId = () => crypto.randomUUID();

/* ---------- Clientes ---------- */

export async function listClients() {
  const db = await getDb();
  const rows = await db.select().from(clients).orderBy(asc(clients.name));
  const counts = await db
    .select({ clientId: analyses.clientId, n: sql<number>`count(*)::int` })
    .from(analyses)
    .groupBy(analyses.clientId);
  const byClient = new Map(counts.map((c) => [c.clientId, c.n]));
  return rows.map((c) => ({ ...c, analyses: byClient.get(c.id) ?? 0 }));
}

export async function getClient(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(clients).where(eq(clients.id, id));
  if (!c) return null;
  const list = await db.select().from(analyses).where(eq(analyses.clientId, id)).orderBy(desc(analyses.updatedAt));
  return { client: c, analyses: list };
}

export async function createClient(data: Omit<ClientRow, "id" | "createdAt">) {
  const db = await getDb();
  const id = newId();
  await db.insert(clients).values({ id, ...data });
  return id;
}

/* ---------- Análises ---------- */

export async function listAnalyses() {
  const db = await getDb();
  const rows = await db
    .select({ a: analyses, clientName: clients.name })
    .from(analyses)
    .innerJoin(clients, eq(clients.id, analyses.clientId))
    .orderBy(asc(analyses.renewalDate));
  const counts = await db
    .select({ analysisId: items.analysisId, n: sql<number>`count(*)::int` })
    .from(items)
    .groupBy(items.analysisId);
  const byAnalysis = new Map(counts.map((c) => [c.analysisId, c.n]));
  return rows.map((r) => ({ ...r.a, clientName: r.clientName, itemCount: byAnalysis.get(r.a.id) ?? 0 }));
}

export interface AnalysisBundle {
  analysis: AnalysisRow;
  client: ClientRow;
  items: ItemRow[];
  answers: AnswerRow[];
  reviews: ReviewRow[];
}

export async function getAnalysis(id: string): Promise<AnalysisBundle | null> {
  const db = await getDb();
  const [a] = await db.select().from(analyses).where(eq(analyses.id, id));
  if (!a) return null;
  const [c] = await db.select().from(clients).where(eq(clients.id, a.clientId));
  const [its, ans, revs] = await Promise.all([
    db.select().from(items).where(eq(items.analysisId, id)).orderBy(asc(items.position), asc(items.createdAt)),
    db.select().from(answers).where(eq(answers.analysisId, id)),
    db.select().from(reviews).where(eq(reviews.analysisId, id)),
  ]);
  return { analysis: a, client: c, items: its, answers: ans, reviews: revs };
}

export function toEngineInput(b: AnalysisBundle, today = todayIso()): AnalysisInput {
  return {
    id: b.analysis.id,
    renewalDate: b.analysis.renewalDate,
    termMonths: b.analysis.termMonths,
    declaredFamilies: b.analysis.declaredFamilies ?? [],
    items: b.items.map((i) => ({
      id: i.id,
      rawSku: i.rawSku,
      rawDescription: i.rawDescription,
      quantity: i.quantity,
      serial: i.serial,
      contractNumber: i.contractNumber,
      startDate: i.startDate,
      endDate: i.endDate,
      unitPrice: i.unitPrice,
      source: i.source,
      sourceRef: i.sourceRef,
      overrideSku: i.overrideSku,
      ignored: i.ignored,
    })),
    answers: b.answers.map((a) => ({
      familyId: a.familyId,
      model: a.model || null,
      questionKey: a.questionKey,
      value: a.value,
      origin: a.origin as EvidenceOrigin,
      evidence: a.evidence,
      author: a.author,
      updatedAt: a.updatedAt?.toISOString() ?? null,
    })),
    reviews: Object.fromEntries(b.reviews.map((r) => [r.findingKey, { decision: r.decision as ReviewDecision, comment: r.comment, findingHash: r.findingHash }])),
    prices: {
      ...Object.fromEntries(b.items.filter((i) => i.unitPrice != null).map((i) => [(i.overrideSku || i.rawSku).toUpperCase(), i.unitPrice!])),
      ...(b.analysis.prices ?? {}),
    },
    today,
  };
}

export async function createAnalysis(data: {
  clientId: string;
  name: string;
  renewalDate: string | null;
  proposalDue: string | null;
  termMonths: number;
  objective: string | null;
  distributor: string | null;
  owner: string | null;
  notes: string | null;
  declaredFamilies: string[];
}) {
  const db = await getDb();
  const id = newId();
  await db.insert(analyses).values({ id, ...data, status: "DRAFT" });
  await audit(id, "Análise criada", data.name);
  return id;
}

export async function updateAnalysis(id: string, patch: Partial<Omit<AnalysisRow, "id" | "createdAt">>) {
  const db = await getDb();
  await db
    .update(analyses)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(analyses.id, id));
}

export async function touchAnalysis(id: string) {
  await updateAnalysis(id, {});
}

/* ---------- Itens ---------- */

export interface NewItem {
  rawSku: string;
  rawDescription?: string | null;
  quantity: number;
  serial?: string | null;
  contractNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  unitPrice?: number | null;
  source: string;
  sourceRef?: string | null;
}

export async function addItems(analysisId: string, rows: NewItem[]) {
  if (rows.length === 0) return 0;
  const db = await getDb();
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${items.position}), 0)::int` })
    .from(items)
    .where(eq(items.analysisId, analysisId));
  const values = rows.map((r, i) => ({
    id: newId(),
    analysisId,
    position: max + i + 1,
    rawSku: r.rawSku.trim(),
    rawDescription: r.rawDescription ?? null,
    quantity: Number.isFinite(r.quantity) ? r.quantity : 0,
    serial: r.serial ?? null,
    contractNumber: r.contractNumber ?? null,
    startDate: r.startDate ?? null,
    endDate: r.endDate ?? null,
    unitPrice: r.unitPrice ?? null,
    source: r.source,
    sourceRef: r.sourceRef ?? null,
  }));
  for (let i = 0; i < values.length; i += 500) await db.insert(items).values(values.slice(i, i + 500));
  const [a] = await db.select({ status: analyses.status }).from(analyses).where(eq(analyses.id, analysisId));
  await updateAnalysis(analysisId, a?.status === "DRAFT" ? { status: "COLLECTING_DATA" } : {});
  return values.length;
}

export async function updateItem(id: string, patch: Partial<Pick<ItemRow, "overrideSku" | "ignored" | "quantity" | "endDate" | "rawDescription">>) {
  const db = await getDb();
  const [row] = await db.update(items).set(patch).where(eq(items.id, id)).returning({ analysisId: items.analysisId });
  if (row) await touchAnalysis(row.analysisId);
  return row?.analysisId;
}

export async function deleteItems(analysisId: string, ids: string[]) {
  const db = await getDb();
  if (ids.length) await db.delete(items).where(and(eq(items.analysisId, analysisId), inArray(items.id, ids)));
  await touchAnalysis(analysisId);
}

export async function deleteItemsBySource(analysisId: string, source: string) {
  const db = await getDb();
  await db.delete(items).where(and(eq(items.analysisId, analysisId), eq(items.source, source)));
}

/* ---------- Respostas ---------- */

export interface AnswerInput {
  familyId: string;
  model?: string | null;
  questionKey: string;
  value: string;
  origin: EvidenceOrigin;
  evidence?: string | null;
  author?: string | null;
}

export async function upsertAnswers(analysisId: string, list: AnswerInput[]) {
  const db = await getDb();
  for (const a of list) {
    const model = a.model ?? "";
    if (a.value === "" || a.value == null) {
      await db
        .delete(answers)
        .where(and(eq(answers.analysisId, analysisId), eq(answers.familyId, a.familyId), eq(answers.model, model), eq(answers.questionKey, a.questionKey)));
      continue;
    }
    await db
      .insert(answers)
      .values({ id: newId(), analysisId, familyId: a.familyId, model, questionKey: a.questionKey, value: a.value, origin: a.origin, evidence: a.evidence ?? null, author: a.author ?? null })
      .onConflictDoUpdate({
        target: [answers.analysisId, answers.familyId, answers.model, answers.questionKey],
        set: { value: a.value, origin: a.origin, evidence: a.evidence ?? null, author: a.author ?? null, updatedAt: new Date() },
      });
  }
  await touchAnalysis(analysisId);
}

/* ---------- Revisão ---------- */

export async function upsertReview(analysisId: string, r: { findingKey: string; decision: ReviewDecision | "clear"; comment?: string | null; reviewer?: string | null; findingHash?: string | null }) {
  const db = await getDb();
  if (r.decision === "clear") {
    await db.delete(reviews).where(and(eq(reviews.analysisId, analysisId), eq(reviews.findingKey, r.findingKey)));
  } else {
    await db
      .insert(reviews)
      .values({ id: newId(), analysisId, findingKey: r.findingKey, decision: r.decision, comment: r.comment ?? null, reviewer: r.reviewer ?? null, findingHash: r.findingHash ?? null })
      .onConflictDoUpdate({
        target: [reviews.analysisId, reviews.findingKey],
        set: { decision: r.decision, comment: r.comment ?? null, reviewer: r.reviewer ?? null, findingHash: r.findingHash ?? null, createdAt: new Date() },
      });
  }
  await touchAnalysis(analysisId);
}

/* ---------- Auditoria ---------- */

export async function audit(analysisId: string | null, action: string, detail?: string | null, actor?: string | null) {
  const db = await getDb();
  await db.insert(auditLog).values({ id: newId(), analysisId, action, detail: detail ?? null, actor: actor ?? "Pré-vendas" });
}

export async function listAudit(analysisId: string) {
  const db = await getDb();
  return db.select().from(auditLog).where(eq(auditLog.analysisId, analysisId)).orderBy(desc(auditLog.at)).limit(50);
}
