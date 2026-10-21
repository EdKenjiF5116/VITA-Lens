import type { FamilyContext, Finding, PendingQuestion, ResolvedItem } from "@/domain/types";
import { daysBetween, formatDate } from "@/lib/dates";
import { ev, joinNames, plural, sumQty } from "../helpers";
import { Q } from "@/packs/common";
import { modelsInScope } from "./lifecycle";

type Out = { findings: Finding[]; pending: PendingQuestion[] };

const describe = (items: ResolvedItem[]) => joinNames(items.map((i) => `${i.quantity} x ${i.effectiveSku}${i.endDate ? ` (${formatDate(i.endDate)})` : ""}`), 6);

/** COV-01 a COV-05: vencimentos, datas divergentes, equipamentos sem licença e itens sem data. */
export function coverageAnalysis(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const today = ctx.today;
  const rule = (id: string, name: string) => ({ id, name });

  // Data lida no portal (co-term) completa itens sem vencimento, sem alterar o item original.
  const portalExp = ctx.str(Q.licensesExpiration);
  const contracts = ctx.licenseItems.map((i) => (!i.endDate && portalExp && i.record?.kind !== "wrapper" ? { ...i, endDate: portalExp } : i));
  const expired = contracts.filter((i) => i.endDate && i.endDate < today);
  const soon = contracts.filter((i) => i.endDate && i.endDate >= today && daysBetween(today, i.endDate) <= 90);
  const noDate = contracts.filter((i) => !i.endDate);
  const dates = [...new Set(contracts.map((i) => i.endDate).filter(Boolean))] as string[];

  if (expired.length) {
    findings.push({
      key: `${pack.id}:COV-01`,
      familyId: pack.id,
      dimension: "coverage",
      verdict: "EXPIRED",
      severity: "critical",
      title: `${plural(expired.length, "contrato vencido", "contratos vencidos")}`,
      explanation: `${describe(expired)}.${pack.coterm ? " No co-term, licença vencida abre 30 dias de carência antes do desligamento." : ""}`,
      recommendation: { type: "ADD_COVERAGE", text: "Priorizar a renovação destes itens." },
      affected: expired.map((i) => i.effectiveSku),
      rule: rule("COV-01", "Contratos vencidos"),
      evidence: expired.map((i) => ev(i.effectiveSku, `venceu em ${formatDate(i.endDate)}`, "documented")),
      sourceIds: pack.coterm ? ["meraki-coterm"] : [],
      confidence: "medium",
      urgency: "high",
    });
  }
  if (soon.length) {
    const first = soon.map((i) => i.endDate!).sort()[0];
    findings.push({
      key: `${pack.id}:COV-02`,
      familyId: pack.id,
      dimension: "coverage",
      verdict: "EXPIRING",
      severity: "attention",
      title: `Vence em ${daysBetween(today, first)} dias`,
      explanation: `${describe(soon)}. Prazo curto para análise, aprovação e pedido.`,
      recommendation: { type: "RENEW_AS_IS", text: "Fechar a análise e a proposta antes do vencimento." },
      affected: soon.map((i) => i.effectiveSku),
      rule: rule("COV-02", "Vencimento em até 90 dias"),
      evidence: [ev("Primeiro vencimento", formatDate(first), "documented")],
      sourceIds: [],
      confidence: "medium",
      urgency: "high",
    });
  }
  if (dates.length > 1) {
    findings.push({
      key: `${pack.id}:COV-03`,
      familyId: pack.id,
      dimension: "coverage",
      verdict: "DIVERGENT_DATES",
      severity: pack.coterm ? "attention" : "opportunity",
      title: `${dates.length} datas de vencimento diferentes`,
      explanation: pack.coterm
        ? "Licenciamento co-term tem uma única data por organização. Datas diferentes indicam mais de uma organização ou dados desatualizados."
        : `Contratos com datas diferentes (${joinNames(dates.sort().map((d) => formatDate(d)))}) geram várias renovações por ano.`,
      recommendation: { type: "CONSOLIDATE_CONTRACTS", text: pack.coterm ? "Confirmar as organizações e a data de co-term de cada uma." : "Avaliar co-terminar os contratos na mesma data." },
      affected: contracts.map((i) => i.effectiveSku),
      rule: rule("COV-03", "Datas divergentes"),
      evidence: dates.sort().map((d) => ev("Vencimento", formatDate(d), "documented")),
      sourceIds: pack.coterm ? ["meraki-coterm"] : [],
      confidence: "medium",
    });
  }
  if (noDate.length && contracts.length) {
    findings.push({
      key: `${pack.id}:COV-05`,
      familyId: pack.id,
      dimension: "data",
      verdict: "MISSING_DATA",
      severity: "info",
      title: `${plural(noDate.length, "item sem data de vencimento", "itens sem data de vencimento")}`,
      explanation: `${describe(noDate)}. Sem a data, vencimentos e prazos ficam fora da análise.`,
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Completar as datas com o contrato ou o portal do fabricante." },
      affected: noDate.map((i) => i.effectiveSku),
      rule: rule("COV-05", "Itens sem vencimento"),
      evidence: [],
      sourceIds: [],
      confidence: "low",
    });
  }

  // COV-04: equipamentos sem licença, suporte ou assinatura.
  if (pack.metric === "HARDWARE_ATTACHED") {
    for (const [model, qty] of modelsInScope(ctx)) {
      const lic = contracts.filter((i) => i.model === model);
      if (lic.length > 0) continue;
      findings.push({
        key: `${pack.id}:COV-04:${model}`,
        familyId: pack.id,
        dimension: "coverage",
        verdict: "NO_COVERAGE",
        severity: "critical",
        title: `${plural(qty, model, model)} sem suporte ou assinatura na lista`,
        explanation: "Os equipamentos aparecem no inventário, mas nenhuma assinatura ou contrato de suporte do modelo foi encontrado.",
        recommendation: { type: "ADD_COVERAGE", text: "Confirmar se existe contrato fora da lista. Se não, incluir suporte e serviços na proposta." },
        affected: [model],
        rule: rule("COV-04", "Equipamento sem cobertura"),
        evidence: [ev("Equipamentos", qty, "documented"), ev("Assinaturas do modelo", 0, "documented")],
        sourceIds: [],
        confidence: "medium",
        urgency: "high",
      });
    }
  } else if (ctx.hardwareItems.length > 0 && contracts.filter((i) => i.record?.kind === "base").length === 0) {
    findings.push({
      key: `${pack.id}:COV-04`,
      familyId: pack.id,
      dimension: "coverage",
      verdict: "NO_COVERAGE",
      severity: "critical",
      title: `${plural(sumQty(ctx.hardwareItems), pack.unit.singular, pack.unit.plural)} sem licença na lista`,
      explanation: `A lista traz equipamentos, mas nenhuma licença ${pack.name}. ${pack.coterm ? "No Meraki o equipamento para de operar sem licença válida." : ""}`,
      recommendation: { type: "ADD_COVERAGE", text: "Confirmar o licenciamento atual com o cliente e incluir as licenças na proposta." },
      affected: ctx.hardwareItems.map((i) => i.effectiveSku),
      rule: rule("COV-04", "Equipamento sem cobertura"),
      evidence: [ev("Equipamentos", sumQty(ctx.hardwareItems), "documented")],
      sourceIds: pack.coterm ? ["meraki-mr-license-guide"] : [],
      confidence: "medium",
      urgency: "high",
    });
  }
  return { findings, pending: [] };
}

/** DEP-01 e MIG-01: dependências do catálogo e SKUs substituídos. */
export function dependencyAnalysis(ctx: FamilyContext, allItems: ResolvedItem[]): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const present = allItems.filter((i) => !i.ignored);
  const seen = new Set<string>();
  for (const item of ctx.licenseItems) {
    for (const dep of item.record?.dependencies ?? []) {
      const ok = present.some(
        (p) =>
          (dep.satisfiedBy?.skuPrefix && p.effectiveSku.startsWith(dep.satisfiedBy.skuPrefix)) ||
          (dep.satisfiedBy?.kind && p.record?.kind === dep.satisfiedBy.kind),
      );
      const key = `${pack.id}:DEP-01:${dep.requires}`;
      if (ok || seen.has(key)) continue;
      seen.add(key);
      const forQuote = dep.forQuote === true;
      findings.push({
        key,
        familyId: pack.id,
        dimension: "dependency",
        verdict: dep.type === "MANDATORY" ? "MANDATORY_DEPENDENCY" : dep.type === "CONDITIONAL" ? "CONDITIONAL_DEPENDENCY" : "RECOMMENDED_ITEM",
        severity: dep.type === "MANDATORY" ? (forQuote ? "attention" : "critical") : dep.type === "CONDITIONAL" ? "attention" : "info",
        title: `${dep.type === "MANDATORY" ? "Dependência obrigatória" : dep.type === "CONDITIONAL" ? "Dependência condicional" : "Item recomendado"}: ${dep.requires}`,
        explanation: `${item.effectiveSku} depende de ${dep.requires}, que não aparece na lista. ${dep.note}`,
        recommendation: { type: "ADD_COVERAGE", text: forQuote ? `Incluir ${dep.requires} na cotação.` : `Incluir ${dep.requires} ou confirmar que já existe fora da lista.` },
        affected: [item.effectiveSku],
        rule: { id: "DEP-01", name: "Dependências do catálogo" },
        evidence: [ev("Item", item.effectiveSku, "documented")],
        sourceIds: dep.sourceIds,
        confidence: "high",
      });
    }
  }
  const legacy = ctx.items.filter((i) => i.record?.legacy);
  if (legacy.length) {
    findings.push({
      key: `${pack.id}:MIG-01`,
      familyId: pack.id,
      dimension: "lifecycle",
      verdict: "MIGRATE",
      severity: "attention",
      title: `${plural(legacy.length, "SKU substituído", "SKUs substituídos")} pelo fabricante`,
      explanation: legacy.map((i) => `${i.effectiveSku} para ${i.record!.legacy!.replacedBy}: ${i.record!.legacy!.note}`).join(" "),
      recommendation: { type: "MIGRATE_PRODUCT", text: "Usar o SKU atual na renovação e confirmar a equivalência de recursos." },
      affected: legacy.map((i) => i.effectiveSku),
      rule: { id: "MIG-01", name: "SKU substituído" },
      evidence: legacy.map((i) => ev(i.effectiveSku, i.record!.legacy!.replacedBy, "documented")),
      sourceIds: [...new Set(legacy.flatMap((i) => i.record!.sourceIds))],
      confidence: legacy.some((i) => i.record?.status === "draft") ? "medium" : "high",
    });
  }
  return { findings, pending: [] };
}
