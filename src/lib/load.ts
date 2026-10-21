import { cache } from "react";
import { notFound } from "next/navigation";
import { getAnalysis, toEngineInput } from "@/db/repo";
import { runAnalysis, findingHash, needsReview } from "@/engine/run";
import { getPack } from "@/packs";
import type { AnalysisResult, Finding } from "@/domain/types";

/** Carrega a análise e roda o motor uma vez por requisição. */
export const loadAnalysis = cache(async (id: string) => {
  const bundle = await getAnalysis(id);
  if (!bundle) notFound();
  const input = toEngineInput(bundle);
  const result = runAnalysis(input);
  return { ...bundle, input, result };
});

export function allFindings(r: AnalysisResult): Finding[] {
  return [...r.general, ...r.families.flatMap((f) => f.findings)];
}

export function reviewState<R extends { findingKey: string; decision: string; findingHash: string | null }>(r: AnalysisResult, reviews: R[]) {
  const toReview = allFindings(r).filter(needsReview);
  const byKey = new Map<string, R>(reviews.map((x) => [x.findingKey, x]));
  const done = toReview.filter((f) => byKey.has(f.key));
  // Achado revisado cujo conteúdo mudou depois (novos dados) precisa de nova olhada.
  const changed = done.filter((f) => byKey.get(f.key)?.findingHash && byKey.get(f.key)!.findingHash !== findingHash(f));
  return { toReview, done, changed, byKey };
}

export function familyName(id: string | null | undefined): string {
  if (!id) return "Geral";
  return getPack(id)?.name ?? id;
}

export function vendorsOf(r: AnalysisResult): string[] {
  const names = new Set<string>();
  for (const i of r.items) if (!i.ignored && i.vendorName) names.add(i.vendorName);
  return [...names];
}
