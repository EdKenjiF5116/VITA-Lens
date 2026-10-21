import type { AnalysisInput, Answer, FamilyContext, ResolvedItem } from "@/domain/types";
import { getPack } from "@/packs";
import { answerKey } from "./helpers";
import { usable } from "./match";

export function answerMap(answers: Answer[]): Map<string, Answer> {
  const m = new Map<string, Answer>();
  for (const a of answers) m.set(answerKey(a.familyId, a.questionKey, a.model), a);
  return m;
}

export function parseList(v: string | null | undefined): string[] | null {
  if (v == null || v === "") return null;
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* valor separado por vírgula */
  }
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Famílias presentes: detectadas nos itens ou declaradas na criação da análise. */
export function familyIds(input: AnalysisInput, items: ResolvedItem[]): string[] {
  const ids = new Set<string>();
  for (const i of items) if (usable(i) && i.familyId) ids.add(i.familyId);
  for (const f of input.declaredFamilies) if (getPack(f)) ids.add(f);
  return [...ids];
}

export function buildContext(input: AnalysisInput, items: ResolvedItem[], familyId: string): FamilyContext {
  const pack = getPack(familyId)!;
  const answers = answerMap(input.answers);
  const famItems = items.filter((i) => usable(i) && i.familyId === familyId);
  const answer = (key: string, model?: string) => answers.get(answerKey(familyId, key, model));
  const str = (key: string, model?: string) => {
    const v = answer(key, model)?.value;
    return v == null || v === "" ? null : v;
  };
  const num = (key: string, model?: string) => {
    const v = str(key, model);
    if (v == null) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  return {
    pack,
    input,
    items: famItems,
    hardwareItems: famItems.filter((i) => i.record?.kind === "hardware"),
    licenseItems: famItems.filter((i) => i.record && i.record.kind !== "hardware"),
    answer,
    num,
    str,
    list: (key, model) => parseList(str(key, model)),
    today: input.today,
  };
}
