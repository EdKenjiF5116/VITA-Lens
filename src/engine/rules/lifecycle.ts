import type { EvidenceOrigin, FamilyContext, Finding, PendingQuestion } from "@/domain/types";
import { findHardware } from "@/packs";
import { Q } from "@/packs/common";
import { addMonths, formatDate, monthsBetween } from "@/lib/dates";
import { ev, joinNames, originOf, pendingFor, plural } from "../helpers";

type Out = { findings: Finding[]; pending: PendingQuestion[] };

/** Modelos de hardware presentes na família e a quantidade de cada um. */
export function modelsInScope(ctx: FamilyContext): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of ctx.hardwareItems) if (i.model) m.set(i.model, (m.get(i.model) ?? 0) + i.quantity);
  if (ctx.pack.metric === "HARDWARE_ATTACHED") {
    for (const i of ctx.licenseItems) {
      if (!i.model || m.has(i.model)) continue;
      const installed = ctx.num(Q.unitsInstalled, i.model) ?? ctx.num(Q.unitsActive, i.model);
      const subs = ctx.licenseItems.filter((x) => x.model === i.model && x.record?.kind !== "addon");
      m.set(i.model, installed ?? (subs.length ? Math.max(...subs.map((x) => x.quantity)) : i.quantity));
    }
  }
  return m;
}

/**
 * LIFE-01 e LIFE-02: fim de venda, fim de suporte, última renovação e prazo pretendido.
 * Respostas (coletadas ou declaradas) têm prioridade sobre o catálogo.
 */
export function lifecycleAnalysis(ctx: FamilyContext): Out {
  const { pack, input } = ctx;
  const findings: Finding[] = [];
  const pending: PendingQuestion[] = [];
  if (pack.hardware.length === 0 && ctx.hardwareItems.length === 0) return { findings, pending };

  const models = modelsInScope(ctx);
  if (models.size === 0) {
    if (pack.metric !== "HARDWARE_ATTACHED" && ctx.licenseItems.length > 0) {
      findings.push({
        key: `${pack.id}:LIFE-00`,
        familyId: pack.id,
        dimension: "lifecycle",
        verdict: "UNKNOWN",
        severity: "info",
        title: "Ciclo de vida não avaliado: lista sem equipamentos",
        explanation: `A lista traz licenças, mas não os modelos de ${pack.unit.plural}. Sem modelos não dá para checar fim de venda e fim de suporte.`,
        recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Importar o inventário de equipamentos (planilha ou coleta pela API do fabricante)." },
        affected: [],
        rule: { id: "LIFE-01", name: "Ciclo de vida do hardware" },
        evidence: [],
        sourceIds: [],
        confidence: "low",
      });
    }
    return { findings, pending };
  }

  const start = input.renewalDate ?? ctx.today;
  const end = addMonths(start, input.termMonths);
  const active: string[] = [];
  const unknown: string[] = [];

  for (const [model, qty] of models) {
    const hw = findHardware(pack, model);
    const lc = hw?.lifecycle;
    const eosAns = ctx.answer(Q.eoxEndOfSale, model);
    const eostAns = ctx.answer(Q.eoxEndOfSupport, model);
    const endOfSaleAt = eosAns?.value || lc?.endOfSaleAt;
    const endOfSupportAt = eostAns?.value || lc?.endOfSupportAt;
    const lastRenewalAt = eostAns?.value ? undefined : lc?.lastRenewalAt;
    const origin: EvidenceOrigin = eostAns ? originOf(eostAns) : lc?.status === "validated" ? "validated" : "documented";
    const confidence = eostAns ? (originOf(eostAns) === "declared" ? "low" : "high") : lc?.status === "validated" ? "high" : "low";
    const successors = hw?.successors ?? [];
    const succText = successors.length ? ` Sucessor sugerido: ${successors.map((s) => s.model).join(" ou ")}.` : "";
    const sourceIds = eostAns ? [] : lc?.sourceIds ?? [];
    const evidence = [
      ev("Equipamentos", qty, "documented"),
      ev("Fim de venda", endOfSaleAt ? formatDate(endOfSaleAt) : null, eosAns ? originOf(eosAns) : origin),
      ev("Fim de suporte", endOfSupportAt ? formatDate(endOfSupportAt) : null, origin, eostAns?.evidence ?? undefined),
      ev("Renovação pretendida", `${formatDate(start)} a ${formatDate(end)} (${input.termMonths} meses)`, "declared"),
    ];
    const refreshEffect = {
      kind: "refresh" as const,
      models: [{ model, quantity: qty, successorSku: successors[0]?.sku, successorModel: successors[0]?.model }],
    };
    const base = {
      key: `${pack.id}:LIFE:${model}`,
      familyId: pack.id,
      dimension: "lifecycle" as const,
      affected: [model],
      evidence,
      sourceIds,
      confidence: confidence as Finding["confidence"],
    };

    if (!endOfSupportAt && !endOfSaleAt) {
      if (lc && lc.status === "validated") active.push(`${model} (${qty})`);
      else {
        unknown.push(model);
        pending.push(pendingFor(ctx, Q.eoxEndOfSupport, pack.hints?.lifecycle ?? "Datas de ciclo de vida não confirmadas para este modelo.", model));
      }
      continue;
    }

    if (endOfSupportAt && endOfSupportAt <= ctx.today) {
      findings.push({
        ...base,
        verdict: "END_OF_SUPPORT",
        severity: "critical",
        title: `${plural(qty, model, model)} fora de suporte desde ${formatDate(endOfSupportAt)}`,
        explanation: `O fabricante encerrou suporte, RMA e atualizações deste modelo. Renovar licença ou assinatura não devolve o suporte do equipamento.${succText}`,
        recommendation: { type: "REFRESH_HARDWARE", text: `Substituir os ${qty} equipamentos antes de contratar renovação de longo prazo.${pack.hints?.refresh ? ` ${pack.hints.refresh}` : ""}` },
        rule: { id: "LIFE-02", name: "Equipamento fora de suporte" },
        urgency: "high",
        effect: refreshEffect,
      });
      continue;
    }

    if (lastRenewalAt && lastRenewalAt < start) {
      findings.push({
        ...base,
        verdict: "REFRESH_REQUIRED",
        severity: "critical",
        title: `${model}: renovação não disponível a partir de ${formatDate(lastRenewalAt)}`,
        explanation: `${pack.hints?.lifecycle ?? "O fabricante limita renovações no fim da vida do produto."} Fim de suporte em ${formatDate(endOfSupportAt)}.${succText}`,
        recommendation: { type: "REFRESH_HARDWARE", text: `Planejar a troca dos ${qty} equipamentos em vez de renovar.` },
        rule: { id: "LIFE-03", name: "Última data de renovação" },
        urgency: "high",
        evidence: [...evidence, ev("Última renovação", formatDate(lastRenewalAt), origin)],
        effect: refreshEffect,
      });
      continue;
    }

    if (endOfSupportAt && endOfSupportAt < end) {
      const usable = monthsBetween(start, endOfSupportAt);
      const maxTerm = pack.supportedTerms.filter((t) => t <= usable).sort((a, b) => b - a)[0];
      findings.push({
        ...base,
        verdict: "RENEWAL_RESTRICTED",
        severity: "attention",
        title: `${model}: prazo de ${input.termMonths} meses passa do fim de suporte`,
        explanation: `O suporte termina em ${formatDate(endOfSupportAt)}, cerca de ${usable} meses após o início da renovação. ${maxTerm ? `O maior prazo que cabe é ${maxTerm} meses.` : "Nenhum prazo padrão cabe inteiro."} Evite contratos que ultrapassem o suporte possível.${succText}`,
        recommendation: {
          type: "REFRESH_HARDWARE",
          text: maxTerm ? `Renovar por ${maxTerm} meses ou avaliar refresh dos ${qty} equipamentos.` : `Avaliar refresh dos ${qty} equipamentos.`,
        },
        rule: { id: "LIFE-01", name: "Renovação dentro do suporte" },
        effect: maxTerm ? { kind: "term-cap", maxTermMonths: maxTerm } : refreshEffect,
      });
      if (maxTerm) {
        findings.push({
          ...base,
          key: `${pack.id}:LIFE-REFRESH:${model}`,
          verdict: "REFRESH_RECOMMENDED",
          severity: "opportunity",
          title: `${model}: oportunidade de refresh`,
          explanation: `Fim de venda ${endOfSaleAt ? `em ${formatDate(endOfSaleAt)}` : "anunciado"}. Trocar agora permite renovar pelo prazo completo de ${input.termMonths} meses.${succText}`,
          recommendation: { type: "REFRESH_HARDWARE", text: `Apresentar o cenário de refresh para os ${qty} equipamentos.` },
          rule: { id: "LIFE-01", name: "Renovação dentro do suporte" },
          effect: refreshEffect,
        });
      }
      continue;
    }

    if (endOfSaleAt) {
      const close = endOfSupportAt ? monthsBetween(end, endOfSupportAt) < 24 : false;
      findings.push({
        ...base,
        verdict: "EOS_ANNOUNCED",
        severity: close ? "attention" : "info",
        title: `${model}: fim de venda ${endOfSaleAt <= ctx.today ? "desde" : "em"} ${formatDate(endOfSaleAt)}`,
        explanation: `Renovável. O suporte vai até ${formatDate(endOfSupportAt)}, depois do fim da renovação pretendida (${formatDate(end)}). ${close ? "Sobra pouca margem: planeje o refresh no próximo ciclo." : "Planeje o refresh para o próximo ciclo."}${succText}`,
        recommendation: { type: "RENEW_AS_IS", text: "Renovar e registrar o refresh no planejamento do cliente." },
        rule: { id: "LIFE-01", name: "Renovação dentro do suporte" },
      });
      continue;
    }
    active.push(`${model} (${qty})`);
  }

  if (active.length) {
    findings.push({
      key: `${pack.id}:LIFE:active`,
      familyId: pack.id,
      dimension: "lifecycle",
      verdict: "ACTIVE",
      severity: "ok",
      title: `${plural(active.length, "modelo ativo", "modelos ativos")}, sem anúncio de fim de venda`,
      explanation: `${joinNames(active, 10)}.`,
      affected: active,
      rule: { id: "LIFE-01", name: "Renovação dentro do suporte" },
      evidence: [],
      sourceIds: [...new Set([...models.keys()].flatMap((m) => findHardware(pack, m)?.lifecycle?.sourceIds ?? []))],
      confidence: "high",
    });
  }
  if (unknown.length) {
    findings.push({
      key: `${pack.id}:LIFE:unknown`,
      familyId: pack.id,
      dimension: "lifecycle",
      verdict: "UNKNOWN",
      severity: "info",
      title: `Ciclo de vida não confirmado: ${joinNames(unknown)}`,
      explanation: `O catálogo ainda não tem datas para ${unknown.length > 1 ? "esses modelos" : "esse modelo"}. ${pack.hints?.lifecycle ?? "Consulte o portal do fabricante e informe as datas na etapa de utilização."}`,
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Preencher fim de venda e fim de suporte por modelo." },
      affected: unknown,
      rule: { id: "LIFE-01", name: "Renovação dentro do suporte" },
      evidence: [],
      sourceIds: [...new Set(unknown.flatMap((m) => findHardware(pack, m)?.lifecycle?.sourceIds ?? []))],
      confidence: "low",
    });
  }
  return { findings, pending };
}

