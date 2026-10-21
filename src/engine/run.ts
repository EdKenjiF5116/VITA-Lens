import type { AnalysisInput, AnalysisResult, FamilyResult, Finding, PendingQuestion, ResolvedItem } from "@/domain/types";
import { daysBetween } from "@/lib/dates";
import { buildContext, familyIds } from "./context";
import { ev, joinNames, plural, stableHash } from "./helpers";
import { resolveItems, usable } from "./match";
import { quantityAttached, quantityPerUnit, quantityPerUser } from "./rules/quantity";
import { adoptionAnalysis, tierAnalysis } from "./rules/tier";
import { lifecycleAnalysis } from "./rules/lifecycle";
import { coverageAnalysis, dependencyAnalysis } from "./rules/coverage";
import { buildScenarios } from "./scenarios";

const SEVERITY_ORDER = { critical: 0, attention: 1, opportunity: 2, info: 3, ok: 4 } as const;
const IMPACT_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function findingHash(f: Finding): string {
  return stableHash(`${f.verdict}|${f.title}|${f.explanation}`);
}

/** Achados que pedem decisão de um revisor (tudo que não é "ok" nem informativo). */
export function needsReview(f: Finding): boolean {
  return f.severity === "critical" || f.severity === "attention" || f.severity === "opportunity";
}

function generalFindings(input: AnalysisInput, items: ResolvedItem[]): Finding[] {
  const out: Finding[] = [];
  const live = items.filter((i) => !i.ignored);
  const unknown = live.filter((i) => i.status === "unrecognized" || (i.status === "partial" && !i.record));
  const noPack = unknown.filter((i) => i.vendor && !i.familyId);
  const broken = live.filter((i) => i.status === "duplicate" || i.status === "inconsistent");

  if (unknown.length) {
    const vendors = [...new Set(noPack.map((i) => i.vendorName).filter(Boolean))] as string[];
    out.push({
      key: "general:DATA-01",
      familyId: null,
      dimension: "data",
      verdict: "UNRECOGNIZED",
      severity: "attention",
      title: `${plural(unknown.length, "item não reconhecido", "itens não reconhecidos")} pelo catálogo`,
      explanation: `${joinNames(unknown.map((i) => i.effectiveSku), 8)}. Itens desconhecidos não são descartados: ficam na fila de revisão e entram nos cenários como estão.${vendors.length ? ` Fabricantes identificados sem pacote ou SKU fora do catálogo: ${joinNames(vendors)}.` : ""}`,
      recommendation: { type: "MANUAL_REVIEW", text: "Corrigir o SKU na tela de itens ou registrar o produto no catálogo." },
      affected: unknown.map((i) => i.effectiveSku),
      rule: { id: "DATA-01", name: "Itens não reconhecidos" },
      evidence: unknown.slice(0, 6).map((i) => ev(i.effectiveSku, i.statusNote ?? "sem correspondência", "documented")),
      sourceIds: [],
      confidence: "high",
    });
  }
  if (broken.length) {
    out.push({
      key: "general:DATA-02",
      familyId: null,
      dimension: "data",
      verdict: "INCONSISTENT",
      severity: "attention",
      title: `${plural(broken.length, "linha duplicada ou inconsistente", "linhas duplicadas ou inconsistentes")}`,
      explanation: `${joinNames(broken.map((i) => `${i.effectiveSku || "(sem SKU)"}: ${i.statusNote}`), 5)}. Essas linhas ficam fora das regras até serem corrigidas.`,
      recommendation: { type: "MANUAL_REVIEW", text: "Corrigir ou ignorar as linhas na tela de itens." },
      affected: broken.map((i) => i.effectiveSku),
      rule: { id: "DATA-02", name: "Duplicidades e inconsistências" },
      evidence: [],
      sourceIds: [],
      confidence: "high",
    });
  }
  if (!input.renewalDate) {
    out.push({
      key: "general:DATA-03",
      familyId: null,
      dimension: "data",
      verdict: "MISSING_DATA",
      severity: "info",
      title: "Data da renovação não informada",
      explanation: "Sem a data, o motor usa a data de hoje para checar prazos e fim de suporte.",
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Informar a data esperada da renovação no resumo da análise." },
      affected: [],
      rule: { id: "DATA-03", name: "Data da renovação" },
      evidence: [],
      sourceIds: [],
      confidence: "high",
    });
  }
  return out;
}

export function runAnalysis(input: AnalysisInput): AnalysisResult {
  const items = resolveItems(input.items);
  const families: FamilyResult[] = [];
  const scenarioInput: Parameters<typeof buildScenarios>[2] = [];

  for (const familyId of familyIds(input, items)) {
    const ctx = buildContext(input, items, familyId);
    const parts: { findings: Finding[]; pending: PendingQuestion[] }[] = [];
    const metric = ctx.pack.metric;
    if (metric === "PER_USER") parts.push(quantityPerUser(ctx));
    else if (metric === "HARDWARE_ATTACHED") parts.push(quantityAttached(ctx));
    else parts.push(quantityPerUnit(ctx));
    parts.push(tierAnalysis(ctx), lifecycleAnalysis(ctx), coverageAnalysis(ctx), dependencyAnalysis(ctx, items), adoptionAnalysis(ctx));
    if (ctx.pack.extraRules) parts.push(ctx.pack.extraRules(ctx));

    const seen = new Map<string, number>();
    const findings = parts
      .flatMap((p) => p.findings)
      .map((f) => {
        const n = seen.get(f.key) ?? 0;
        seen.set(f.key, n + 1);
        return n ? { ...f, key: `${f.key}#${n}` } : f;
      })
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    const pendingMap = new Map<string, PendingQuestion>();
    for (const p of parts.flatMap((x) => x.pending)) if (!pendingMap.has(p.answerKey)) pendingMap.set(p.answerKey, p);
    const pending = [...pendingMap.values()].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);

    families.push({ familyId, findings, pending });
    scenarioInput.push({ ctx, findings });
  }

  const general = generalFindings(input, items);
  const all = [...general, ...families.flatMap((f) => f.findings)];
  const pendingAll = families.flatMap((f) => f.pending);
  const expiringIn90 = items.filter(
    (i) => usable(i) && i.record?.kind !== "hardware" && i.endDate && daysBetween(input.today, i.endDate) <= 90,
  ).length;

  return {
    items,
    families,
    general,
    scenarios: buildScenarios(input, items, scenarioInput),
    summary: {
      itemCount: items.filter((i) => !i.ignored).length,
      recognized: items.filter((i) => !i.ignored && i.status === "recognized").length,
      unrecognized: items.filter((i) => !i.ignored && (i.status === "unrecognized" || (i.status === "partial" && !i.record))).length,
      critical: all.filter((f) => f.severity === "critical").length,
      attention: all.filter((f) => f.severity === "attention").length,
      opportunity: all.filter((f) => f.severity === "opportunity").length,
      pendingHigh: pendingAll.filter((p) => p.impact === "high").length,
      pendingTotal: pendingAll.length,
      lifecycleAttention: all.filter((f) => f.dimension === "lifecycle" && (f.severity === "critical" || f.severity === "attention")).length,
      expiringIn90,
    },
  };
}
