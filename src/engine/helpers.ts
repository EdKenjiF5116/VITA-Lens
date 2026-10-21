import type {
  Answer,
  Confidence,
  EvidenceOrigin,
  EvidenceRef,
  FamilyContext,
  FamilyPack,
  Feature,
  PendingQuestion,
  ResolvedItem,
  Tier,
} from "@/domain/types";

export const ORIGIN_CONFIDENCE: Record<EvidenceOrigin, Confidence> = {
  declared: "low",
  documented: "medium",
  collected: "high",
  validated: "high",
};

const RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

export function minConfidence(...values: (Confidence | undefined | null)[]): Confidence {
  const v = values.filter(Boolean) as Confidence[];
  if (v.length === 0) return "low";
  return v.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));
}

/** Catálogo em rascunho limita a confiança a média. */
export function capForDraft(c: Confidence, draft: boolean): Confidence {
  return draft && c === "high" ? "medium" : c;
}

export function sumQty(items: ResolvedItem[]): number {
  return items.reduce((s, i) => s + (Number.isFinite(i.quantity) ? i.quantity : 0), 0);
}

export function answerKey(familyId: string, questionKey: string, model?: string | null): string {
  return `${familyId}::${model ?? ""}::${questionKey}`;
}

export function originOf(a: Answer | undefined): EvidenceOrigin {
  return a?.origin ?? "declared";
}

export function ev(label: string, value: string | number | null | undefined, origin: EvidenceOrigin, detail?: string): EvidenceRef {
  return { label, value: value == null || value === "" ? "não informado" : String(value), origin, detail };
}

export function pendingFor(ctx: FamilyContext, questionKey: string, reason: string, model?: string): PendingQuestion {
  const q = ctx.pack.questions.find((x) => x.key === questionKey);
  return {
    answerKey: answerKey(ctx.pack.id, questionKey, model),
    familyId: ctx.pack.id,
    model,
    questionKey,
    label: q ? (model ? `${model}: ${q.label}` : q.label) : questionKey,
    reason,
    impact: q?.impact ?? "medium",
  };
}

export function tierById(pack: FamilyPack, id?: string | null): Tier | undefined {
  return pack.tiers.find((t) => t.id === id);
}

/** Nível mais baixo que inclui a funcionalidade. */
export function minTierFor(pack: FamilyPack, f: Feature): Tier | undefined {
  return pack.tiers
    .filter((t) => f.tiers.includes(t.id))
    .sort((a, b) => a.rank - b.rank)[0];
}

export function featureName(pack: FamilyPack, id: string): string {
  return pack.features.find((f) => f.id === id)?.name ?? id;
}

export function joinNames(names: string[], max = 6): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const body = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} e ${shown[shown.length - 1]}` : shown[0];
  return rest > 0 ? `${body} (mais ${rest})` : body;
}

export function plural(n: number, singular: string, pluralWord: string): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

export function isLicense(i: ResolvedItem): boolean {
  return !!i.record && i.record.kind !== "hardware";
}

/** Chaves de cobertura para contar assinaturas por equipamento. */
export function coverageKeys(i: ResolvedItem): string[] {
  const r = i.record;
  if (!r) return [];
  if (r.entitlements?.length) return r.entitlements;
  return [r.serviceKey ?? r.tierId ?? r.kind];
}

export function stableHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
