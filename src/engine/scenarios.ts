import type { AnalysisInput, FamilyContext, Finding, ResolvedItem, Scenario, ScenarioLine, SkuRecord } from "@/domain/types";
import { lookupSku, PACKS, findHardware } from "@/packs";
import { DUO_PRICE_BANDS } from "@/packs/cisco-duo";
import { Q } from "@/packs/common";
import { coverageKeys, sumQty } from "./helpers";
import { currentTiers } from "./rules/tier";
import { modelsInScope } from "./rules/lifecycle";
import { usable } from "./match";

type ScenarioId = Scenario["id"];
const TBD = "A-DEFINIR";

function describeSku(sku: string): { description: string; record?: SkuRecord } {
  const rec = lookupSku(sku);
  if (rec) return { description: rec.description, record: rec };
  for (const p of PACKS) {
    const parsed = p.parseSku?.(sku);
    if (parsed) return { description: parsed.description, record: parsed as SkuRecord };
  }
  return { description: sku.startsWith(TBD) ? "Item a definir com o especialista" : "SKU fora do catálogo" };
}

/** Preço unitário para o prazo da linha: preço informado na análise ou preço de lista do catálogo. */
export function unitPriceFor(sku: string, qty: number, term: number | undefined, prices: Record<string, number>): number | null {
  if (prices[sku] != null && Number.isFinite(prices[sku])) return prices[sku];
  const rec = lookupSku(sku);
  const lp = rec?.listPrice;
  if (!lp) return null;
  if (lp.per === "unit-month") {
    const bands = DUO_PRICE_BANDS[sku];
    const monthly = bands ? [...bands].reverse().find((b) => qty >= b.minQty)?.amount ?? lp.amount : lp.amount;
    return Math.round(monthly * (term ?? 12) * 100) / 100;
  }
  return lp.amount;
}

interface Builder {
  input: AnalysisInput;
  ctx: FamilyContext;
  findings: Finding[];
}

const rejected = (input: AnalysisInput, key: string) => input.reviews[key]?.decision === "rejected";
const accepted = (input: AnalysisInput, key: string) => ["accepted", "adjusted"].includes(input.reviews[key]?.decision ?? "");

function mk(familyId: string, sku: string, quantity: number, termMonths: number | undefined, change: ScenarioLine["change"], reason: string): ScenarioLine {
  return { familyId, sku, description: describeSku(sku).description, quantity, termMonths, change, reason };
}

const REFRESH_REASON: Record<string, string> = {
  END_OF_SUPPORT: "fora de suporte",
  REFRESH_REQUIRED: "renovação não disponível",
  REFRESH_RECOMMENDED: "suporte termina antes do fim do contrato",
  RENEWAL_RESTRICTED: "suporte termina antes do fim do contrato",
};
const reasonFor = (f: Finding) => REFRESH_REASON[f.verdict] ?? "risco de ciclo de vida";
const serviceSku = (vendor: string) => `${TBD}-SERVICO-${vendor.toUpperCase()}`;

/** Mesmo produto, nível e modelo: só muda o prazo ou o sufixo de renovação. */
function sameProduct(a?: SkuRecord, b?: SkuRecord): boolean {
  if (!a || !b) return false;
  return a.familyId === b.familyId && a.model === b.model && a.tierId === b.tierId && (a.entitlements ?? []).join() === (b.entitlements ?? []).join() && !!a.haSecondary === !!b.haSecondary;
}

/** Junta linhas iguais (mesmo SKU, prazo e tipo de mudança) somando quantidades. */
function mergeLines(lines: ScenarioLine[]): ScenarioLine[] {
  const out: ScenarioLine[] = [];
  const idx = new Map<string, number>();
  for (const l of lines) {
    const k = `${l.familyId}|${l.sku}|${l.termMonths ?? ""}|${l.change}`;
    if (idx.has(k) && !l.sku.startsWith(TBD)) out[idx.get(k)!].quantity += l.quantity;
    else {
      idx.set(k, out.length);
      out.push({ ...l });
    }
  }
  return out;
}

function refreshEffects(b: Builder) {
  return b.findings
    .filter((f) => f.effect?.kind === "refresh" && !rejected(b.input, f.key))
    .flatMap((f) => (f.effect as Extract<Finding["effect"], { kind: "refresh" }>).models.map((m) => ({ ...m, finding: f })));
}

function termCap(b: Builder, model?: string): number {
  const caps = b.findings
    .filter((f) => f.effect?.kind === "term-cap" && !rejected(b.input, f.key) && (!model || f.key.endsWith(`:${model}`)))
    .map((f) => (f.effect as { maxTermMonths: number }).maxTermMonths);
  return Math.min(b.input.termMonths, ...caps);
}

function quoteDependencies(b: Builder): ScenarioLine[] {
  const out: ScenarioLine[] = [];
  for (const item of b.ctx.licenseItems) {
    for (const dep of item.record?.dependencies ?? []) {
      if (!dep.forQuote || !dep.satisfiedBy?.skuPrefix) continue;
      const sku = dep.satisfiedBy.skuPrefix;
      if (b.ctx.items.some((i) => i.effectiveSku.startsWith(sku)) || out.some((l) => l.sku === sku)) continue;
      out.push(mk(b.ctx.pack.id, sku, 1, undefined, "add", `${dep.requires}: obrigatório no pedido.`));
    }
  }
  return out;
}

function keepOthers(b: Builder, term: number): ScenarioLine[] {
  return b.ctx.licenseItems
    .filter((i) => ["addon", "support", "wrapper", "service"].includes(i.record!.kind) && (b.ctx.pack.metric !== "HARDWARE_ATTACHED" || !i.model))
    .map((i) => mk(b.ctx.pack.id, i.effectiveSku, i.quantity, i.record?.kind === "wrapper" ? undefined : term, "keep", "Item acessório renovado nas mesmas condições."));
}

/* ---------- Famílias por unidade ou por usuário ---------- */

function unitFamily(b: Builder, id: ScenarioId): { lines: ScenarioLine[]; risks: string[]; assumptions: string[] } {
  const { ctx, input, findings } = b;
  const { pack } = ctx;
  const lines: ScenarioLine[] = [];
  const risks: string[] = [];
  const assumptions: string[] = [];
  const baseItems = ctx.licenseItems.filter((i) => i.record?.kind === "base" || i.record?.kind === "bundle");
  if (baseItems.length === 0) return { lines, risks, assumptions };
  const contracted = sumQty(baseItems);
  const { current } = currentTiers(ctx);
  const qtyF = findings.find((f) => f.effect?.kind === "quantity");
  const upF = findings.find((f) => f.verdict === "UPGRADE_REQUIRED" && f.effect?.kind === "tier" && !rejected(input, f.key));
  const downF = findings.find((f) => f.verdict === "POSSIBLE_DOWNGRADE" && f.effect?.kind === "tier");
  const planF = findings.find((f) => f.verdict === "UPGRADE_FOR_PLAN" && f.effect?.kind === "tier" && !rejected(input, f.key));
  const refresh = refreshEffects(b);

  const renewal = (tierId: string | undefined, term: number) => {
    if (!tierId) return null;
    return pack.renewalSku({ tierId, termMonths: term });
  };
  const existingSkus = new Set(baseItems.map((i) => i.effectiveSku));
  const fallbackSku = () => {
    const one = [...existingSkus];
    if (one.length === 1) return lookupSku(one[0])?.legacy?.replacedBy ?? one[0];
    return `${TBD}-${pack.id.toUpperCase()}`;
  };

  let tierId = current?.id;
  let qty = contracted;
  let term = input.termMonths;
  if (id !== "equivalent") {
    if (upF) tierId = (upF.effect as { suggestedTierId: string }).suggestedTierId;
    else if (downF && accepted(input, downF.key)) tierId = (downF.effect as { suggestedTierId: string }).suggestedTierId;
    else if (downF) assumptions.push(`Downgrade sugerido em ${pack.name} não aplicado: só entra quando o revisor aceita.`);
    if (qtyF && !rejected(input, qtyF.key) && qtyF.effect?.kind === "quantity") qty = qtyF.effect.required;
    term = id === "refresh" && refresh.length ? input.termMonths : termCap(b);
    if (term < input.termMonths) assumptions.push(`${pack.name}: prazo limitado a ${term} meses para não passar do fim de suporte.`);
  }
  if (id === "expansion") {
    const growth = ctx.num(Q.growthUnits) ?? ctx.num(Q.growthUsers) ?? 0;
    qty += growth;
    if (growth) assumptions.push(`${pack.name}: inclui crescimento previsto de ${growth} ${pack.unit.plural}.`);
    if (planF) tierId = (planF.effect as { suggestedTierId: string }).suggestedTierId;
  }

  const sku = renewal(tierId, term) ?? fallbackSku();
  const tierName = pack.tiers.find((t) => t.id === tierId)?.name ?? "nível atual";
  const sameAsBefore = existingSkus.has(sku) || baseItems.some((i) => sameProduct(i.record, describeSku(sku).record));
  const change: ScenarioLine["change"] = sameAsBefore ? (qty === contracted ? "keep" : "adjust") : "replace";
  const why =
    id === "equivalent"
      ? `Mesmo nível (${tierName}) e quantidade.`
      : `${tierName}, ${qty} ${pack.unit.plural}${qty !== contracted ? ` (antes ${contracted})` : ""}.`;
  lines.push(mk(pack.id, sku, qty, term, change, why));
  if (sku.startsWith(TBD) || !renewal(tierId, term)) risks.push(`${pack.name}: SKU de renovação não cadastrado para ${tierName} em ${term} meses. Validar com o distribuidor.`);
  lines.push(...keepOthers(b, term), ...quoteDependencies(b));

  if (id === "refresh") {
    for (const r of refresh) {
      lines.push(mk(pack.id, r.successorSku ?? `${TBD}-HW`, r.quantity, undefined, "add", `Substitui ${r.quantity} ${r.model} (${reasonFor(r.finding)}).`));
      const succ = findHardware(pack, r.model)?.successors?.[0];
      if (succ?.status === "draft") risks.push(`${r.model}: sucessor ${succ.model} é sugestão do pacote. ${succ.note ?? ""}`.trim());
    }
    if (refresh.length) {
      lines.push(mk(pack.id, serviceSku(pack.vendor), 1, undefined, "add", `Serviço profissional de migração e instalação ${pack.vendorName} (a cotar).`));
      if (pack.hints?.refresh) risks.push(pack.hints.refresh);
    }
  }
  if (id === "expansion") {
    const growthUnits = ctx.num(Q.growthUnits) ?? 0;
    if (growthUnits > 0 && pack.hardware.length) lines.push(mk(pack.id, `${TBD}-HW`, growthUnits, undefined, "add", `Novos ${pack.unit.plural} para o crescimento previsto (modelo a dimensionar).`));
  }
  return { lines, risks, assumptions };
}

/* ---------- Famílias com assinatura presa ao equipamento ---------- */

function attachedFamily(b: Builder, id: ScenarioId): { lines: ScenarioLine[]; risks: string[]; assumptions: string[] } {
  const { ctx, input, findings } = b;
  const { pack } = ctx;
  const lines: ScenarioLine[] = [];
  const risks: string[] = [];
  const assumptions: string[] = [];
  const models = modelsInScope(ctx);
  const tiered = pack.tiers.length > 0;
  const { perModel } = currentTiers(ctx);
  const upF = findings.find((f) => f.verdict === "UPGRADE_REQUIRED" && !rejected(input, f.key));
  const downF = findings.find((f) => f.verdict === "POSSIBLE_DOWNGRADE");
  const planF = findings.find((f) => f.verdict === "UPGRADE_FOR_PLAN" && !rejected(input, f.key));
  const refresh = id === "refresh" ? refreshEffects(b) : [];
  const refreshByModel = new Map(refresh.map((r) => [r.model, r]));
  if (downF && !accepted(input, downF.key) && id !== "equivalent") assumptions.push(`${pack.name}: redução sugerida não aplicada, aguardando aceite do revisor.`);

  for (const [model, units] of models) {
    const lic = ctx.licenseItems.filter((i) => i.model === model);
    if (lic.length === 0) continue;
    const qtyF = findings.find((f) => f.key === `${pack.id}:QTY-02:${model}`);
    const required = qtyF?.effect?.kind === "quantity" && !rejected(input, qtyF.key) ? qtyF.effect.required : units;
    const haSec = ctx.num(Q.unitsHaSecondary, model) ?? 0;
    const term = id === "equivalent" ? input.termMonths : termCap(b, model);
    if (term < input.termMonths && !refreshByModel.has(model)) assumptions.push(`${model}: prazo limitado a ${term} meses para não passar do fim de suporte.`);

    if (id === "equivalent") {
      for (const i of lic) {
        const key = i.record?.tierId ?? (i.record?.entitlements?.length === 1 ? i.record.entitlements[0] : undefined);
        const sku = (key && pack.renewalSku({ tierId: key, termMonths: term, model, haSecondary: i.record?.haSecondary })) || i.record?.legacy?.replacedBy || i.effectiveSku;
        const same = sku === i.effectiveSku || sameProduct(i.record, describeSku(sku).record);
        lines.push(mk(pack.id, sku, i.quantity, term, same ? "keep" : "replace", same && sku !== i.effectiveSku ? `${model}: mesma assinatura e quantidade, SKU de renovação para ${term} meses.` : `${model}: mesma assinatura e quantidade.`));
      }
      continue;
    }

    const r = refreshByModel.get(model);
    const targetModel = r?.successorModel && !r.successorSku?.startsWith(TBD) ? r.successorModel : model;
    const lineTerm = r ? input.termMonths : term;

    if (tiered) {
      let tierId = perModel.get(model)?.id;
      if (upF?.effect?.kind === "tier") tierId = upF.effect.suggestedTierId;
      else if (downF?.effect?.kind === "tier" && accepted(input, downF.key)) tierId = downF.effect.suggestedTierId;
      if (id === "expansion" && planF?.effect?.kind === "tier") tierId = planF.effect.suggestedTierId;
      const sku = (tierId && pack.renewalSku({ tierId, termMonths: lineTerm, model: targetModel })) || `${TBD}-${targetModel}`;
      if (sku.startsWith(TBD)) risks.push(`${targetModel}: SKU de renovação não cadastrado. Validar com o distribuidor.`);
      const before = sumQty(lic.filter((i) => coverageKeys(i).includes("protection")));
      lines.push(mk(pack.id, sku, required, lineTerm, r ? "replace" : before === required ? "keep" : "adjust", `${targetModel}: ${pack.tiers.find((t) => t.id === tierId)?.name ?? "nível atual"} para ${required} equipamentos.`));
      for (const i of lic.filter((x) => !coverageKeys(x).includes("protection"))) lines.push(mk(pack.id, i.effectiveSku, i.quantity, lineTerm, "keep", `${model}: item acessório mantido.`));
    } else {
      const addonName = (k: string) => pack.addons?.find((a) => a.id === k)?.name ?? k;
      const entitled = new Set(lic.flatMap((i) => coverageKeys(i)));
      const add = upF?.effect?.kind === "addons" ? upF.effect.add : [];
      const remove = downF?.effect?.kind === "addons" && accepted(input, downF.key) ? downF.effect.remove : [];
      for (const a of add) entitled.add(a);

      // Pacotes com várias assinaturas (ex.: Core Security) ficam como pacote, salvo se algo dele sair.
      const bundles = lic.filter((i) => i.record?.kind === "bundle" && (i.record.entitlements?.length ?? 0) > 1);
      const bundleKeys = new Set(bundles.flatMap((i) => i.record!.entitlements!));
      const keepBundle = bundles.length > 0 && !remove.some((a) => bundleKeys.has(a));
      const handled = new Set<string>();
      if (keepBundle) {
        for (const sku of new Set(bundles.map((i) => i.effectiveSku))) {
          const target = r ? sku.replace(model, targetModel) : sku;
          lines.push(mk(pack.id, target, required, lineTerm, r ? "replace" : "adjust", `${targetModel}: pacote mantido (${[...bundleKeys].map(addonName).join(", ")}).`));
        }
        bundleKeys.forEach((k) => handled.add(k));
      }
      for (const a of remove) {
        entitled.delete(a);
        const old = lic.find((i) => coverageKeys(i).includes(a));
        lines.push(mk(pack.id, old?.effectiveSku ?? `${model} ${addonName(a)}`, old?.quantity ?? required, lineTerm, "remove", `${model}: ${addonName(a)} retirada após aceite do revisor.`));
      }
      for (const key of entitled) {
        if (handled.has(key)) continue;
        // Suporte cobre todas as unidades; assinaturas podem usar SKU HA2 na segunda unidade.
        const usesHa = haSec > 0 && key !== "PREM";
        const qty = usesHa ? Math.max(0, required - haSec) : required;
        const sku = pack.renewalSku({ tierId: key, termMonths: lineTerm, model: targetModel }) ?? `${TBD}-${targetModel}-${key}`;
        lines.push(mk(pack.id, sku, qty, lineTerm, r ? "replace" : add.includes(key) ? "add" : "adjust", `${targetModel}: ${addonName(key)}.`));
        if (usesHa) {
          const haSku = pack.renewalSku({ tierId: key, termMonths: lineTerm, model: targetModel, haSecondary: true });
          if (haSku) lines.push(mk(pack.id, haSku, haSec, lineTerm, "adjust", `${targetModel}: ${addonName(key)}, segunda unidade do par HA.`));
        }
      }
    }

    if (r) {
      lines.push(mk(pack.id, r.successorSku ?? `${TBD}-HW`, r.quantity, undefined, "add", `Substitui ${r.quantity} ${model} (${reasonFor(r.finding)}).`));
      const succ = findHardware(pack, model)?.successors?.[0];
      if (succ?.note) risks.push(`${model} para ${succ.model}: ${succ.note}`);
    }
  }
  if (refresh.length) lines.push(mk(pack.id, serviceSku(pack.vendor), 1, undefined, "add", `Serviço profissional de migração de configuração e instalação ${pack.vendorName} (a cotar).`));
  if (id === "expansion") {
    const growth = ctx.num(Q.growthUnits) ?? 0;
    if (growth > 0) {
      lines.push(mk(pack.id, `${TBD}-HW`, growth, undefined, "add", `Novos ${pack.unit.plural} previstos (modelo a dimensionar).`));
      assumptions.push(`${pack.name}: inclui ${growth} equipamentos novos. Assinaturas a dimensionar com o modelo escolhido.`);
    }
  }
  return { lines, risks, assumptions };
}

const META: Record<ScenarioId, { name: string; summary: string }> = {
  equivalent: { name: "Renovação equivalente", summary: "Mantém quantidades, níveis e suporte. Troca só SKUs substituídos ou de renovação. Mostra os riscos que continuam." },
  optimized: { name: "Renovação otimizada", summary: "Ajusta quantidades, corrige inconsistências e adequa níveis, preservando os requisitos informados." },
  refresh: { name: "Renovação com refresh", summary: "Substitui equipamentos com risco de ciclo de vida, considera sucessores e serviço de migração e evita contratos além do suporte." },
  expansion: { name: "Expansão", summary: "Parte da otimizada e soma crescimento previsto e recursos planejados." },
};

export function buildScenarios(input: AnalysisInput, items: ResolvedItem[], fams: { ctx: FamilyContext; findings: Finding[] }[]): Scenario[] {
  const ids: ScenarioId[] = ["equivalent", "optimized", "refresh", "expansion"];
  const orphans = items.filter((i) => !i.ignored && (i.status === "unrecognized" || (i.status === "partial" && !usable(i))));

  return ids.map((id) => {
    const lines: ScenarioLine[] = [];
    const risks: string[] = [];
    const assumptions: string[] = [];
    for (const f of fams) {
      const b = { input, ctx: f.ctx, findings: f.findings };
      const r = f.ctx.pack.metric === "HARDWARE_ATTACHED" ? attachedFamily(b, id) : unitFamily(b, id);
      lines.push(...r.lines);
      risks.push(...r.risks);
      assumptions.push(...r.assumptions);
      if (id === "equivalent") {
        for (const fd of f.findings.filter((x) => x.severity === "critical" || (x.dimension === "lifecycle" && x.severity === "attention"))) risks.push(`${f.ctx.pack.name}: ${fd.title}.`);
      }
      if (id === "optimized") {
        for (const fd of f.findings.filter((x) => x.dimension === "lifecycle" && x.severity === "critical")) risks.push(`${f.ctx.pack.name}: ${fd.title}. Ver cenário com refresh.`);
      }
    }
    for (const o of orphans) lines.push({ ...mk("outros", o.effectiveSku, o.quantity, undefined, "keep", "Item sem pacote de catálogo: mantido para revisão manual."), description: o.rawDescription || describeSku(o.effectiveSku).description });
    if (orphans.length) risks.push(orphans.length === 1 ? "1 item sem pacote de catálogo entra sem análise." : `${orphans.length} itens sem pacote de catálogo entram sem análise.`);

    let amount = 0;
    const missing = new Set<string>();
    const merged = mergeLines(lines);
    lines.length = 0;
    lines.push(...merged);
    for (const l of lines) {
      if (l.change === "remove") continue;
      l.unitPrice = l.sku.startsWith(TBD) ? (input.prices[l.sku] ?? null) : unitPriceFor(l.sku, l.quantity, l.termMonths, input.prices);
      l.lineTotal = l.unitPrice == null ? null : Math.round(l.unitPrice * l.quantity * 100) / 100;
      if (l.lineTotal == null) missing.add(l.sku);
      else amount += l.lineTotal;
    }
    const priced = lines.some((l) => l.lineTotal != null);
    return {
      id,
      ...META[id],
      lines,
      risks: [...new Set(risks)],
      assumptions: [...new Set(assumptions)],
      total: priced ? { amount: Math.round(amount * 100) / 100, currency: "USD", complete: missing.size === 0, missingPrices: [...missing] } : null,
    };
  });
}
