"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addItems,
  audit,
  createAnalysis,
  createClient,
  deleteItems,
  deleteItemsBySource,
  getAnalysis,
  toEngineInput,
  updateAnalysis,
  updateItem,
  upsertAnswers,
  upsertReview,
  type AnswerInput,
  type NewItem,
} from "@/db/repo";
import type { EvidenceOrigin, ReviewDecision } from "@/domain/types";
import { parseLooseDate, todayIso } from "@/lib/dates";
import { parseNumber } from "@/lib/import";
import { collectMeraki, demoCollected, toAnalysisData } from "@/connectors/meraki";
import { runAnalysis, findingHash } from "@/engine/run";
import { getPack, normalizeSku } from "@/packs";
import { parseList } from "@/engine/context";

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};
const refresh = (id: string) => revalidatePath(`/app/analyses/${id}`, "layout");

/* ---------- Clientes ---------- */

export async function createClientAction(fd: FormData) {
  const name = s(fd, "name");
  if (!name) throw new Error("Informe a razão social.");
  const id = await createClient({
    name,
    tradeName: s(fd, "tradeName"),
    cnpj: s(fd, "cnpj"),
    sector: s(fd, "sector"),
    sites: parseNumber(s(fd, "sites")),
    region: s(fd, "region"),
    criticality: s(fd, "criticality"),
    salesOwner: s(fd, "salesOwner"),
    technicalOwner: s(fd, "technicalOwner"),
    contact: s(fd, "contact"),
    notes: s(fd, "notes"),
  });
  revalidatePath("/app/clients");
  redirect(`/app/clients/${id}`);
}

/* ---------- Análises ---------- */

export async function createAnalysisAction(fd: FormData) {
  let clientId = s(fd, "clientId");
  const newClient = s(fd, "newClient");
  if (clientId === "__new" || !clientId) {
    if (!newClient) throw new Error("Escolha um cliente ou informe o nome de um novo.");
    clientId = await createClient({ name: newClient, tradeName: null, cnpj: null, sector: null, sites: null, region: null, criticality: null, salesOwner: null, technicalOwner: null, contact: null, notes: null });
  }
  const id = await createAnalysis({
    clientId,
    name: s(fd, "name") ?? "Nova análise de renovação",
    renewalDate: parseLooseDate(s(fd, "renewalDate")),
    proposalDue: parseLooseDate(s(fd, "proposalDue")),
    termMonths: Number(s(fd, "termMonths") ?? 36),
    objective: s(fd, "objective"),
    distributor: s(fd, "distributor"),
    owner: s(fd, "owner"),
    notes: s(fd, "notes"),
    declaredFamilies: fd.getAll("families").map(String).filter((f) => getPack(f)),
  });
  revalidatePath("/app", "layout");
  redirect(`/app/analyses/${id}/import`);
}

export async function updateAnalysisAction(fd: FormData) {
  const id = s(fd, "id")!;
  await updateAnalysis(id, {
    name: s(fd, "name") ?? undefined,
    renewalDate: parseLooseDate(s(fd, "renewalDate")),
    proposalDue: parseLooseDate(s(fd, "proposalDue")),
    termMonths: Number(s(fd, "termMonths") ?? 36),
    objective: s(fd, "objective"),
    distributor: s(fd, "distributor"),
    owner: s(fd, "owner"),
    notes: s(fd, "notes"),
    declaredFamilies: fd.getAll("families").map(String).filter((f) => getPack(f)),
  });
  await audit(id, "Dados da análise atualizados");
  refresh(id);
}

export async function setStatusAction(fd: FormData) {
  const id = s(fd, "id")!;
  const status = s(fd, "status")!;
  await updateAnalysis(id, { status });
  await audit(id, "Status alterado", status);
  refresh(id);
  revalidatePath("/app");
}

/* ---------- Importação ---------- */

export interface ParsedSheet {
  name: string;
  rows: string[][];
}

/** Lê CSV ou XLSX no servidor e devolve as linhas para o mapeamento de colunas. */
export async function parseFileAction(fd: FormData): Promise<{ sheets: ParsedSheet[]; error?: string }> {
  const file = fd.get("file");
  if (!(file instanceof File)) return { sheets: [], error: "Selecione um arquivo." };
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const Papa = (await import("papaparse")).default;
      const text = buf.toString("utf8").replace(/^﻿/, "");
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true, delimiter: "" });
      return { sheets: [{ name: file.name, rows: parsed.data.slice(0, 5000).map((r) => r.map((c) => String(c ?? ""))) }] };
    }
    if (name.endsWith(".xlsx")) {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const sheets: ParsedSheet[] = [];
      wb.eachSheet((ws) => {
        const rows: string[][] = [];
        // Mantém a numeração de linhas do Excel (linhas vazias viram linhas vazias).
        ws.eachRow({ includeEmpty: false }, (row) => {
          while (rows.length < row.number - 1 && rows.length < 5000) rows.push([]);
          const values = (row.values as unknown[]).slice(1).map((v) => {
            if (v == null) return "";
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            if (typeof v === "object") {
              const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
              if (o.richText) return o.richText.map((t) => t.text).join("");
              if (o.text != null) return String(o.text);
              if (o.result != null) return o.result instanceof Date ? o.result.toISOString().slice(0, 10) : String(o.result);
              return "";
            }
            return String(v);
          });
          if (rows.length < 5000) rows.push(values);
        });
        if (rows.length) sheets.push({ name: ws.name, rows });
      });
      return { sheets };
    }
    return { sheets: [], error: "Formato não suportado. Use .xlsx ou .csv (Excel antigo .xls: salve como .xlsx)." };
  } catch (e) {
    return { sheets: [], error: `Não foi possível ler o arquivo: ${(e as Error).message}` };
  }
}

export async function importRowsAction(analysisId: string, rows: NewItem[], label: string) {
  const n = await addItems(analysisId, rows);
  await audit(analysisId, "Importação", `${n} linhas de ${label}`);
  refresh(analysisId);
  revalidatePath("/app");
  return n;
}

export async function addManualItemAction(fd: FormData) {
  const id = s(fd, "analysisId")!;
  const sku = s(fd, "sku");
  if (!sku) return;
  await addItems(id, [
    {
      rawSku: sku,
      rawDescription: s(fd, "description"),
      quantity: parseNumber(s(fd, "quantity")) ?? 1,
      serial: s(fd, "serial"),
      endDate: parseLooseDate(s(fd, "endDate")),
      contractNumber: s(fd, "contractNumber"),
      unitPrice: parseNumber(s(fd, "unitPrice")),
      source: "manual",
      sourceRef: "Preenchimento manual",
    },
  ]);
  await audit(id, "Item manual", sku);
  refresh(id);
}

export async function collectMerakiAction(
  analysisId: string,
  opts: { mode: "demo" | "api"; apiKey?: string; orgId?: string },
): Promise<{ ok: boolean; summary: string[]; error?: string }> {
  try {
    const collected =
      opts.mode === "demo"
        ? demoCollected(todayIso())
        : await collectMeraki({ apiKey: opts.apiKey ?? "", orgId: opts.orgId ?? "" });
    const data = toAnalysisData(collected);
    // Nova coleta substitui a anterior. A chave de API não é guardada.
    await deleteItemsBySource(analysisId, "meraki-api");
    await addItems(analysisId, data.items);
    const bundle = await getAnalysis(analysisId);
    const existing = new Map((bundle?.answers ?? []).map((a) => [`${a.familyId}::${a.model}::${a.questionKey}`, a]));
    const answers: AnswerInput[] = data.answers.map((a) => {
      if (a.merge === "union") {
        const prev = existing.get(`${a.familyId}::${a.model ?? ""}::${a.questionKey}`);
        const merged = [...new Set([...(parseList(prev?.value) ?? []), ...(parseList(a.value) ?? [])])];
        return { ...a, value: JSON.stringify(merged), author: "Conector Meraki" };
      }
      return { ...a, author: "Conector Meraki" };
    });
    await upsertAnswers(analysisId, answers);
    await audit(analysisId, "Coleta Meraki API", `${opts.mode === "demo" ? "Modo demonstração. " : ""}${data.summary[0]}`);
    refresh(analysisId);
    return { ok: true, summary: data.summary };
  } catch (e) {
    return { ok: false, summary: [], error: (e as Error).message };
  }
}

/* ---------- Itens ---------- */

export async function itemAction(fd: FormData) {
  const analysisId = s(fd, "analysisId")!;
  const itemId = s(fd, "itemId")!;
  const op = s(fd, "op");
  if (op === "ignore") await updateItem(itemId, { ignored: true });
  else if (op === "restore") await updateItem(itemId, { ignored: false });
  else if (op === "delete") await deleteItems(analysisId, [itemId]);
  else if (op === "override") {
    const sku = s(fd, "overrideSku");
    await updateItem(itemId, { overrideSku: sku ? normalizeSku(sku) : null });
    await audit(analysisId, "SKU corrigido", sku ?? "correção removida");
  } else if (op === "qty") {
    const q = parseNumber(s(fd, "quantity"));
    if (q != null) await updateItem(itemId, { quantity: q });
  }
  refresh(analysisId);
}

export async function clearItemsAction(fd: FormData) {
  const analysisId = s(fd, "analysisId")!;
  const ids = fd.getAll("ids").map(String);
  await deleteItems(analysisId, ids);
  await audit(analysisId, "Itens removidos", `${ids.length} itens`);
  refresh(analysisId);
}

/* ---------- Utilização (discovery) ---------- */

/**
 * Campos do formulário: v|familia|modelo|chave (valor), o|... (origem), e|... (evidência).
 * Multiseleção chega como vários valores com o mesmo nome.
 */
export async function saveAnswersAction(fd: FormData) {
  const analysisId = s(fd, "analysisId")!;
  const author = s(fd, "author") ?? "Pré-vendas";
  const keys = new Set<string>();
  for (const k of fd.keys()) if (k.startsWith("v|") || k.startsWith("m|")) keys.add(k.slice(2));
  const list: AnswerInput[] = [];
  for (const key of keys) {
    const [familyId, model, questionKey] = key.split("|");
    let value: string;
    if (fd.has(`m|${key}`)) {
      // Nada marcado = não informado. "Nenhum destes" marcado = lista vazia de propósito.
      const vals = fd.getAll(`v|${key}`).map(String).filter(Boolean);
      value = vals.length === 0 ? "" : JSON.stringify(vals.filter((v) => v !== "__none"));
    } else {
      value = s(fd, `v|${key}`) ?? "";
    }
    // Tabelas por modelo usam uma origem e uma evidência por linha.
    const group = questionKey.startsWith("eox.") ? "life" : "units";
    const origin = (s(fd, `o|${key}`) ?? s(fd, `orow|${familyId}|${model}|${group}`) ?? "declared") as EvidenceOrigin;
    const evidence = s(fd, `e|${key}`) ?? s(fd, `erow|${familyId}|${model}|${group}`);
    list.push({ familyId, model: model || null, questionKey, value, origin, evidence, author });
  }
  await upsertAnswers(analysisId, list);
  await audit(analysisId, "Respostas de utilização salvas", getPack(list[0]?.familyId ?? "")?.name ?? null, author);
  refresh(analysisId);
}

/* ---------- Revisão ---------- */

export async function reviewAction(fd: FormData) {
  const analysisId = s(fd, "analysisId")!;
  const findingKey = s(fd, "findingKey")!;
  const decision = (s(fd, "decision") ?? "accepted") as ReviewDecision | "clear";
  const bundle = await getAnalysis(analysisId);
  if (!bundle) return;
  const result = runAnalysis(toEngineInput(bundle));
  const finding = [...result.general, ...result.families.flatMap((f) => f.findings)].find((f) => f.key === findingKey);
  const reviewer = s(fd, "reviewer") ?? "Especialista";
  await upsertReview(analysisId, { findingKey, decision, comment: s(fd, "comment"), reviewer, findingHash: finding ? findingHash(finding) : null });
  await audit(analysisId, decision === "clear" ? "Revisão desfeita" : `Recomendação ${decision === "accepted" ? "aceita" : decision === "rejected" ? "rejeitada" : "ajustada"}`, finding?.title ?? findingKey, reviewer);
  if (bundle.analysis.status === "COLLECTING_DATA" || bundle.analysis.status === "DRAFT") await updateAnalysis(analysisId, { status: "NEEDS_REVIEW" });
  refresh(analysisId);
}

/* ---------- Preços ---------- */

export async function savePricesAction(fd: FormData) {
  const analysisId = s(fd, "analysisId")!;
  const bundle = await getAnalysis(analysisId);
  const prices: Record<string, number> = { ...(bundle?.analysis.prices ?? {}) };
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("p|")) continue;
    const sku = k.slice(2);
    const n = parseNumber(String(v));
    if (n == null) delete prices[sku];
    else prices[sku] = n;
  }
  await updateAnalysis(analysisId, { prices });
  await audit(analysisId, "Preços de referência atualizados", `${Object.keys(prices).length} SKUs`);
  refresh(analysisId);
}
