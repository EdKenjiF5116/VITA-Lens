import type { FamilyContext, Finding, PendingQuestion, Tier } from "@/domain/types";
import { Q } from "@/packs/common";
import { capForDraft, ev, featureName, joinNames, minTierFor, ORIGIN_CONFIDENCE, originOf, pendingFor } from "../helpers";

type Out = { findings: Finding[]; pending: PendingQuestion[] };

/** Nível efetivo contratado. Upgrade + base equivale ao nível do upgrade (ex.: MR Enterprise + Upgrade = Advanced). */
export function currentTiers(ctx: FamilyContext): { current?: Tier; perModel: Map<string, Tier>; all: Tier[] } {
  const { pack } = ctx;
  const rank = (id?: string) => pack.tiers.find((t) => t.id === id);
  const perModel = new Map<string, Tier>();
  const all: Tier[] = [];
  const items = ctx.licenseItems.filter((i) => i.record?.tierId && ["base", "bundle", "upgrade", "support"].includes(i.record.kind));
  for (const i of items) {
    const t = rank(i.record!.tierId);
    if (!t) continue;
    all.push(t);
    if (i.model) {
      const prev = perModel.get(i.model);
      if (!prev || t.rank > prev.rank) perModel.set(i.model, t);
    }
  }
  if (all.length === 0) return { perModel, all };
  if (pack.metric === "HARDWARE_ATTACHED" && perModel.size > 0) {
    // O menor nível entre os modelos limita o que o cliente pode usar em todo o parque.
    const current = [...perModel.values()].sort((a, b) => a.rank - b.rank)[0];
    return { current, perModel, all };
  }
  const current = all.sort((a, b) => b.rank - a.rank)[0];
  return { current, perModel, all };
}

/** TIER-01: o nível contratado corresponde aos recursos usados e planejados? */
export function tierAnalysis(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const pending: PendingQuestion[] = [];
  const used = ctx.list(Q.featuresUsed);
  const planned = ctx.list(Q.featuresPlanned) ?? [];
  const usedAns = ctx.answer(Q.featuresUsed);
  const draft = pack.status === "draft";
  const key = `${pack.id}:TIER-01`;
  const rule = { id: "TIER-01", name: "Nível contratado x recursos usados" };

  if (pack.tiers.length === 0 && pack.addons?.length) return addonAnalysis(ctx);
  const { current, perModel } = currentTiers(ctx);
  if (!current) return { findings, pending };

  if (used == null) {
    pending.push(pendingFor(ctx, Q.featuresUsed, "Sem os recursos usados não dá para avaliar downgrade, upgrade ou adoção."));
    findings.push({
      key,
      familyId: pack.id,
      dimension: "tier",
      verdict: "UNDETERMINED",
      severity: "info",
      title: `Nível ${current.name}: uso dos recursos não informado`,
      explanation: "Informe quais recursos o cliente usa para comparar com o nível contratado.",
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Levantar recursos em uso (painel do fabricante ou conversa com o cliente)." },
      affected: [],
      rule,
      evidence: [ev("Nível contratado", current.name, "documented")],
      sourceIds: [],
      confidence: "low",
    });
    return { findings, pending };
  }

  const feats = (ids: string[]) => ids.map((id) => pack.features.find((f) => f.id === id)).filter(Boolean) as typeof pack.features;
  const needed = (ids: string[]) => feats(ids).map((f) => minTierFor(pack, f)).filter(Boolean) as Tier[];
  const maxTier = (ts: Tier[]) => ts.sort((a, b) => b.rank - a.rank)[0];
  const usedReq = maxTier(needed(used));
  const plannedReq = maxTier(needed(planned));
  const missing = feats(used).filter((f) => !f.tiers.includes(current.id));
  const plannedMissing = feats(planned).filter((f) => !f.tiers.includes(current.id));
  const confidence = capForDraft(ORIGIN_CONFIDENCE[originOf(usedAns)], draft);
  const sourceIds = [...new Set(feats([...used, ...planned]).flatMap((f) => f.sourceIds))];
  const modelNote =
    perModel.size > 1 && new Set([...perModel.values()].map((t) => t.id)).size > 1
      ? ` Níveis por modelo: ${[...perModel].map(([m, t]) => `${m} ${t.name}`).join(", ")}.`
      : "";
  const evidence = [
    ev("Nível contratado", current.name, "documented"),
    ev("Recursos em uso", joinNames(used.map((id) => featureName(pack, id))) || "nenhum marcado", originOf(usedAns)),
    ev("Recursos planejados", joinNames(planned.map((id) => featureName(pack, id))) || "nenhum", originOf(ctx.answer(Q.featuresPlanned))),
  ];
  const base = { key, familyId: pack.id, dimension: "tier" as const, rule, evidence, sourceIds, confidence, affected: ctx.licenseItems.map((i) => i.effectiveSku) };

  if (missing.length > 0) {
    const target = maxTier(needed(missing.map((f) => f.id)))!;
    findings.push({
      ...base,
      verdict: "UPGRADE_REQUIRED",
      severity: "critical",
      title: `Recurso em uso não incluído no ${current.name}`,
      explanation: `${joinNames(missing.map((f) => f.name))} ${missing.length > 1 ? "exigem" : "exige"} o nível ${target.name}.${modelNote}`,
      recommendation: { type: "UPGRADE_LICENSE", text: `Renovar no nível ${target.name}.${pack.hints?.upgrade ? ` ${pack.hints.upgrade}` : ""}` },
      effect: { kind: "tier", suggestedTierId: target.id },
    });
    return { findings, pending };
  }

  const usedRank = usedReq?.rank ?? 1;
  if (usedRank < current.rank) {
    const exclusive = feats(planned).filter((f) => !pack.tiers.some((t) => t.rank < current.rank && f.tiers.includes(t.id)));
    if (plannedReq && plannedReq.rank >= current.rank) {
      findings.push({
        ...base,
        verdict: "ADEQUATE",
        severity: "ok",
        title: `Manter ${current.name}: há projeto que depende do nível`,
        explanation: `O uso atual caberia em um nível inferior, mas ${joinNames(exclusive.map((f) => f.name))} ${exclusive.length > 1 ? "estão planejados e exigem" : "está planejado e exige"} o ${current.name}. Não realizar downgrade antes de validar o projeto.${modelNote}`,
        recommendation: { type: "RENEW_AS_IS", text: "Manter o nível e confirmar o cronograma do projeto com o cliente." },
      });
    } else {
      const target = pack.tiers.find((t) => t.rank === Math.max(usedRank, plannedReq?.rank ?? 1))!;
      findings.push({
        ...base,
        verdict: "POSSIBLE_DOWNGRADE",
        severity: "opportunity",
        title: `Uso informado cabe no ${target.name}`,
        explanation: `Nenhum recurso exclusivo do ${current.name} aparece como usado ou planejado.${modelNote} A redução depende de validação: confirme se não há uso não declarado.`,
        recommendation: { type: "POSSIBLE_DOWNGRADE", text: `Avaliar renovar no nível ${target.name}.${pack.hints?.downgrade ? ` ${pack.hints.downgrade}` : ""}` },
        effect: { kind: "tier", suggestedTierId: target.id },
      });
    }
  } else {
    findings.push({
      ...base,
      verdict: "ADEQUATE",
      severity: "ok",
      title: `Nível ${current.name} compatível com o uso informado`,
      explanation: `Os recursos em uso exigem o ${current.name}.${modelNote}`,
      recommendation: { type: "RENEW_AS_IS", text: "Manter o nível na renovação." },
    });
  }

  if (plannedMissing.length > 0) {
    const target = maxTier(needed(plannedMissing.map((f) => f.id)))!;
    findings.push({
      ...base,
      key: `${pack.id}:TIER-02`,
      rule: { id: "TIER-02", name: "Recurso planejado fora do nível" },
      verdict: "UPGRADE_FOR_PLAN",
      severity: "opportunity",
      title: `Projeto planejado exige ${target.name}`,
      explanation: `${joinNames(plannedMissing.map((f) => f.name))} não ${plannedMissing.length > 1 ? "estão incluídos" : "está incluído"} no ${current.name}. Entra no cenário de expansão.`,
      recommendation: { type: "UPGRADE_LICENSE", text: `Apresentar o cenário de expansão com ${target.name}.` },
      effect: { kind: "tier", suggestedTierId: target.id },
    });
  }
  return { findings, pending };
}

/** Variante para fabricantes com assinaturas avulsas (ex.: Palo Alto). */
function addonAnalysis(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const pending: PendingQuestion[] = [];
  const entitled = new Set(ctx.licenseItems.flatMap((i) => i.record?.entitlements ?? []));
  if (entitled.size === 0) return { findings, pending };
  const used = ctx.list(Q.featuresUsed);
  const planned = ctx.list(Q.featuresPlanned) ?? [];
  const rule = { id: "TIER-01", name: "Assinaturas contratadas x recursos usados" };
  const addonName = (id: string) => pack.addons?.find((a) => a.id === id)?.name ?? id;
  const evidenceBase = [ev("Assinaturas contratadas", joinNames([...entitled].map(addonName), 10), "documented")];

  if (used == null) {
    pending.push(pendingFor(ctx, Q.featuresUsed, "Sem os recursos usados não dá para avaliar assinaturas sobrando ou faltando."));
    findings.push({
      key: `${pack.id}:TIER-01`,
      familyId: pack.id,
      dimension: "tier",
      verdict: "UNDETERMINED",
      severity: "info",
      title: "Uso das assinaturas não informado",
      explanation: "Informe os recursos de segurança em uso para comparar com as assinaturas.",
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Levantar perfis de segurança aplicados nas políticas." },
      affected: [],
      rule,
      evidence: evidenceBase,
      sourceIds: [],
      confidence: "low",
    });
    return { findings, pending };
  }

  const confidence = capForDraft(ORIGIN_CONFIDENCE[originOf(ctx.answer(Q.featuresUsed))], pack.status === "draft");
  const neededFor = (ids: string[]) => new Set(ids.flatMap((id) => pack.features.find((f) => f.id === id)?.tiers ?? []));
  const usedAddons = neededFor(used);
  const plannedAddons = neededFor(planned);
  const missing = [...usedAddons].filter((a) => !entitled.has(a));
  const idle = [...entitled].filter((a) => a !== "PREM" && !usedAddons.has(a) && !plannedAddons.has(a));
  const evidence = [...evidenceBase, ev("Recursos em uso", joinNames(used.map((id) => featureName(pack, id))) || "nenhum", originOf(ctx.answer(Q.featuresUsed)))];
  const base = { familyId: pack.id, dimension: "tier" as const, rule, evidence, sourceIds: [], confidence, affected: ctx.licenseItems.map((i) => i.effectiveSku) };

  if (missing.length) {
    findings.push({
      ...base,
      key: `${pack.id}:TIER-01`,
      verdict: "UPGRADE_REQUIRED",
      severity: "critical",
      title: `Recurso em uso sem assinatura: ${joinNames(missing.map(addonName))}`,
      explanation: "Há recurso marcado como usado cuja assinatura não aparece na lista. Pode ser item faltando na lista ou uso sem licença.",
      recommendation: { type: "UPGRADE_LICENSE", text: `Incluir ${joinNames(missing.map(addonName))} na renovação ou confirmar o contrato.` },
      effect: { kind: "addons", add: missing, remove: [] },
    });
  }
  if (idle.length) {
    findings.push({
      ...base,
      key: `${pack.id}:TIER-03`,
      verdict: "POSSIBLE_DOWNGRADE",
      severity: "opportunity",
      title: `Assinatura sem uso informado: ${joinNames(idle.map(addonName))}`,
      explanation: "Nenhum recurso dessa assinatura aparece como usado ou planejado. Pode sair da renovação ou virar oportunidade de adoção.",
      recommendation: { type: "POSSIBLE_DOWNGRADE", text: `Avaliar retirar ${joinNames(idle.map(addonName))}.${pack.hints?.downgrade ? ` ${pack.hints.downgrade}` : ""}` },
      effect: { kind: "addons", add: [], remove: idle },
    });
  }
  if (!missing.length && !idle.length) {
    findings.push({
      ...base,
      key: `${pack.id}:TIER-01`,
      verdict: "ADEQUATE",
      severity: "ok",
      title: "Assinaturas compatíveis com o uso informado",
      explanation: "Todos os recursos em uso têm assinatura e todas as assinaturas têm uso ou plano.",
      recommendation: { type: "RENEW_AS_IS", text: "Renovar as mesmas assinaturas." },
    });
  }
  return { findings, pending };
}

/** ADOPT-01: recursos incluídos sem evidência de uso. Oportunidade, não obrigação. */
export function adoptionAnalysis(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const used = ctx.list(Q.featuresUsed);
  if (used == null) return { findings: [], pending: [] };
  const planned = ctx.list(Q.featuresPlanned) ?? [];
  let included: string[] = [];
  if (pack.tiers.length) {
    const { current } = currentTiers(ctx);
    if (!current) return { findings: [], pending: [] };
    included = pack.features.filter((f) => f.tiers.includes(current.id)).map((f) => f.id);
  } else {
    const entitled = new Set(ctx.licenseItems.flatMap((i) => i.record?.entitlements ?? []));
    included = pack.features.filter((f) => f.tiers.some((t) => entitled.has(t))).map((f) => f.id);
  }
  const idle = pack.features.filter((f) => included.includes(f.id) && !used.includes(f.id) && !planned.includes(f.id) && f.id !== "standard");
  if (idle.length === 0) return { findings: [], pending: [] };
  const withService = idle.filter((f) => f.needsService);
  return {
    findings: [
      {
        key: `${pack.id}:ADOPT-01`,
        familyId: pack.id,
        dimension: "adoption",
        verdict: "ADOPTION_OPPORTUNITY",
        severity: "opportunity",
        title: `${idle.length} ${idle.length === 1 ? "recurso incluído" : "recursos incluídos"} sem evidência de uso`,
        explanation: `${joinNames(idle.map((f) => f.name), 8)}. São oportunidades de adoção, não uma obrigação de uso.${withService.length ? ` ${joinNames(withService.map((f) => f.name))} normalmente ${withService.length > 1 ? "exigem" : "exige"} serviço de implantação.` : ""}`,
        recommendation: {
          type: withService.length ? "PROFESSIONAL_SERVICE" : "ENABLE_FEATURE",
          text: withService.length ? "Apresentar os recursos e oferecer serviço de implantação para os que exigem projeto." : "Apresentar os recursos ao cliente e avaliar a ativação.",
        },
        affected: [],
        rule: { id: "ADOPT-01", name: "Recursos incluídos x utilizados" },
        evidence: [ev("Recursos em uso", joinNames(used.map((id) => featureName(pack, id))) || "nenhum", originOf(ctx.answer(Q.featuresUsed)))],
        sourceIds: [...new Set(idle.flatMap((f) => f.sourceIds))],
        confidence: capForDraft(ORIGIN_CONFIDENCE[originOf(ctx.answer(Q.featuresUsed))], pack.status === "draft"),
      },
    ],
    pending: [],
  };
}
