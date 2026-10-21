import type { EvidenceRef, FamilyContext, Finding, PendingQuestion, QuantityLedger } from "@/domain/types";
import { Q } from "@/packs/common";
import { capForDraft, coverageKeys, ev, minConfidence, ORIGIN_CONFIDENCE, originOf, pendingFor, plural, sumQty } from "../helpers";

type Out = { findings: Finding[]; pending: PendingQuestion[] };

/** QTY-01: licenças por equipamento gerenciado (AP, switch). */
export function quantityPerUnit(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const pending: PendingQuestion[] = [];
  const u = pack.unit;

  const baseItems = ctx.licenseItems.filter((i) => i.record?.kind === "base" || i.record?.kind === "bundle");
  const listed = sumQty(baseItems);
  const collectedAns = ctx.answer(Q.licensesContracted);
  const collectedLimit = ctx.num(Q.licensesContracted);
  // Limite lido no portal do fabricante vale mais que a lista enviada.
  const contracted = collectedLimit ?? listed;
  const hwDoc = sumQty(ctx.hardwareItems);
  if (baseItems.length && collectedLimit != null && collectedLimit !== listed) {
    findings.push({
      key: `${pack.id}:QTY-04`,
      familyId: pack.id,
      dimension: "data",
      verdict: "INCONSISTENT",
      severity: "attention",
      title: `Lista enviada (${listed}) diverge do portal (${collectedLimit})`,
      explanation: "A quantidade de licenças na lista importada é diferente do limite lido no portal do fabricante. O motor usa o valor coletado.",
      recommendation: { type: "MANUAL_REVIEW", text: "Confirmar com o cliente se há licenças fora da lista ou pedidos ainda não aplicados." },
      affected: baseItems.map((i) => i.effectiveSku),
      rule: { id: "QTY-04", name: "Lista x portal" },
      evidence: [ev("Lista importada", listed, "documented"), ev("Portal do fabricante", collectedLimit, originOf(collectedAns))],
      sourceIds: [],
      confidence: "high",
    });
  }

  const installedAns = ctx.answer(Q.unitsInstalled);
  const installed = ctx.num(Q.unitsInstalled) ?? (hwDoc > 0 ? hwDoc : null);
  const installedOrigin = installedAns ? originOf(installedAns) : "documented";
  const active = ctx.num(Q.unitsActive);
  const spareAns = ctx.num(Q.unitsSpare);
  const spare = spareAns ?? (installed != null && active != null ? Math.max(0, installed - active) : null);
  const spareOrigin = ctx.answer(Q.unitsSpare) ? originOf(ctx.answer(Q.unitsSpare)) : "declared";
  const sparesLicensed = ctx.str(Q.sparesLicensed) ?? "unknown";
  const growth = ctx.num(Q.growthUnits) ?? 0;

  if (active == null) pending.push(pendingFor(ctx, Q.unitsActive, "Sem esse número não dá para comparar contratado e utilizado."));
  if (installed == null) pending.push(pendingFor(ctx, Q.unitsInstalled, "Envie o inventário ou informe o total de equipamentos."));
  if ((spare ?? 0) > 0 && sparesLicensed === "unknown") {
    pending.push(pendingFor(ctx, Q.sparesLicensed, pack.hints?.spares ?? "Define se a contingência entra na quantidade necessária."));
  }

  const minReq = active;
  const maxReq = active != null ? active + (spare ?? 0) : null;
  const required = active == null ? null : sparesLicensed === "yes" ? maxReq : sparesLicensed === "no" ? minReq : spare ? null : active;

  const ledger: QuantityLedger = {
    unitPlural: u.plural,
    rows: [
      { key: "contracted", label: "Licenças contratadas", value: baseItems.length || collectedLimit != null ? contracted : null },
      { key: "installed", label: "Instalados", value: installed },
      { key: "active", label: "Em uso", value: active },
      { key: "spare", label: "Contingência", value: spare },
      { key: "required", label: "Necessário", value: required ?? (minReq != null && maxReq != null ? maxReq : null), emphasis: true },
      { key: "growth", label: "Crescimento previsto", value: growth || null },
    ],
    difference: null,
  };

  const evidence: EvidenceRef[] = [
    ev("Licenças na lista importada", baseItems.length ? listed : null, "documented", baseItems.map((i) => `${i.quantity} x ${i.effectiveSku}`).join(", ")),
    ...(collectedLimit != null ? [ev("Limite de licenças no portal", collectedLimit, originOf(collectedAns), collectedAns?.evidence ?? undefined)] : []),
    ev("Instalados", installed, installedOrigin, installedAns ? undefined : hwDoc > 0 ? "Soma dos equipamentos importados" : undefined),
    ev("Em uso", active, originOf(ctx.answer(Q.unitsActive))),
    ev("Contingência", spare, spareOrigin),
    ev("Contingência precisa de licença", { yes: "sim", no: "não", unknown: "não informado" }[sparesLicensed] ?? sparesLicensed, originOf(ctx.answer(Q.sparesLicensed))),
  ];
  const confidence = capForDraft(
    minConfidence(ORIGIN_CONFIDENCE[originOf(ctx.answer(Q.unitsActive))], ORIGIN_CONFIDENCE[installedOrigin]),
    baseItems.some((i) => i.record?.status === "draft") || pack.status === "draft",
  );
  const common = {
    familyId: pack.id,
    dimension: "quantity" as const,
    affected: baseItems.map((i) => i.effectiveSku),
    rule: { id: "QTY-01", name: "Contratado x instalado x utilizado" },
    sourceIds: pack.rules.filter((r) => r.id.endsWith("-03") || r.id === "MR-03").flatMap((r) => r.sourceIds),
    evidence,
    ledger,
  };

  if (baseItems.length === 0 && collectedLimit == null) {
    findings.push({
      ...common,
      key: `${pack.id}:QTY-01`,
      verdict: "UNDETERMINED",
      severity: "info",
      title: `Nenhuma licença de ${u.plural} na lista`,
      explanation: "A lista importada não traz licenças base desta família. Sem elas não há o que comparar com o parque.",
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Pedir ao cliente a lista de licenças ou o relatório do portal do fabricante." },
      confidence: "low",
    });
    return { findings, pending };
  }

  if (active == null) {
    findings.push({
      ...common,
      key: `${pack.id}:QTY-01`,
      verdict: "UNDETERMINED",
      severity: "info",
      title: "Quantidade não avaliada: falta o número em uso",
      explanation: `Há ${plural(contracted, "licença", "licenças")} na lista${installed != null ? ` e ${plural(installed, u.singular, u.plural)} no parque` : ""}, mas sem o número de ${u.plural} em uso a análise não fecha.`,
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: `Informar quantos ${u.plural} estão em uso.` },
      confidence: "low",
    });
    return { findings, pending };
  }

  const effectRequired = required ?? Math.min(Math.max(contracted, minReq!), maxReq!);
  const effect = { kind: "quantity" as const, required: effectRequired, contracted, growth };

  if (required == null) {
    // Contingência com licenciamento indefinido: necessário fica entre "em uso" e "em uso + contingência".
    if (contracted >= minReq! && contracted <= maxReq!) {
      ledger.difference = 0;
      findings.push({
        ...common,
        key: `${pack.id}:QTY-01`,
        verdict: "NEEDS_VALIDATION",
        severity: "attention",
        title: `${contracted} licenças coerentes com o parque, se a contingência precisar de licença`,
        explanation: `São ${plural(active, u.singular, u.plural)} em uso e ${plural(spare ?? 0, u.singular, u.plural)} de contingência. A quantidade atual é coerente com o parque desde que os equipamentos de contingência também precisem permanecer gerenciados e cobertos.${pack.hints?.spares ? ` ${pack.hints.spares}` : ""}`,
        recommendation: { type: "COLLECT_MORE_INFORMATION", text: `Confirmar se a contingência precisa de licença. Se não precisar, a renovação pode cair para ${minReq}.` },
        confidence,
        effect,
      });
      return { findings, pending };
    }
  }

  const target = required ?? (contracted > maxReq! ? maxReq! : minReq!);
  const diff = contracted - target;
  ledger.difference = diff;
  if (diff === 0) {
    findings.push({
      ...common,
      key: `${pack.id}:QTY-01`,
      verdict: "ADEQUATE",
      severity: "ok",
      title: `Quantidade adequada: ${contracted} licenças para ${target} ${u.plural}`,
      explanation: `As licenças contratadas cobrem exatamente o necessário (${active} em uso${sparesLicensed === "yes" && spare ? ` mais ${spare} de contingência` : ""}).`,
      recommendation: { type: "RENEW_AS_IS", text: "Renovar a mesma quantidade." },
      confidence,
      effect,
    });
  } else if (diff > 0) {
    findings.push({
      ...common,
      key: `${pack.id}:QTY-01`,
      verdict: "POSSIBLE_SURPLUS",
      severity: "opportunity",
      title: `${plural(diff, "licença aparentemente excedente", "licenças aparentemente excedentes")}`,
      explanation: `Contratadas ${contracted}, necessárias ${target} (${active} em uso${sparesLicensed === "yes" && spare ? ` mais ${spare} de contingência` : ""}). Antes de reduzir, confirme crescimento previsto${growth ? ` (${growth} informados)` : ""} e equipamentos fora do inventário.`,
      recommendation: { type: "ADJUST_QUANTITY", text: `Avaliar renovar ${target} licenças em vez de ${contracted}.` },
      confidence,
      effect,
    });
  } else {
    findings.push({
      ...common,
      key: `${pack.id}:QTY-01`,
      verdict: "POSSIBLE_DEFICIT",
      severity: "critical",
      title: `Déficit potencial de ${plural(-diff, "licença", "licenças")}`,
      explanation: `Contratadas ${contracted}, necessárias ${target}. Equipamentos sem licença podem deixar o ambiente fora de conformidade.`,
      recommendation: { type: "ADJUST_QUANTITY", text: `Incluir ${-diff} licenças na renovação ou confirmar se há equipamentos a desativar.` },
      confidence,
      urgency: "high",
      effect,
    });
  }
  return { findings, pending };
}

/** QTY-03: licenças por usuário. Não reduz para "ativos" sem política para inativos. */
export function quantityPerUser(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const pending: PendingQuestion[] = [];
  const baseItems = ctx.licenseItems.filter((i) => i.record?.kind === "base");
  const contracted = sumQty(baseItems);
  const registered = ctx.num(Q.usersRegistered);
  const active = ctx.num(Q.usersActive);
  const policy = ctx.str(Q.inactivePolicy) ?? "unknown";
  const growth = ctx.num(Q.growthUsers) ?? 0;

  if (registered == null) pending.push(pendingFor(ctx, Q.usersRegistered, "Base para comparar com as licenças contratadas."));
  if (active == null) pending.push(pendingFor(ctx, Q.usersActive, "Mostra quantos usuários realmente usam a solução."));
  const manyInactive = registered != null && active != null && active < registered * 0.9;
  if (manyInactive && policy === "unknown") {
    pending.push(pendingFor(ctx, Q.inactivePolicy, `${registered! - active!} usuários sem autenticação recente. Sem política, o motor não recomenda reduzir.`));
  }

  const evidence: EvidenceRef[] = [
    ev("Licenças na lista importada", contracted || null, "documented", baseItems.map((i) => `${i.quantity} x ${i.effectiveSku}`).join(", ")),
    ev("Usuários cadastrados", registered, originOf(ctx.answer(Q.usersRegistered))),
    ev("Usuários ativos (90 dias)", active, originOf(ctx.answer(Q.usersActive))),
    ev("Política para inativos", { remove: "podem ser removidos", keep: "precisam continuar", unknown: "não definida" }[policy] ?? policy, originOf(ctx.answer(Q.inactivePolicy))),
  ];
  const confidence = minConfidence(ORIGIN_CONFIDENCE[originOf(ctx.answer(Q.usersRegistered))], ORIGIN_CONFIDENCE[originOf(ctx.answer(Q.usersActive))]);
  const minReq = active ?? registered;
  const maxReq = registered;
  const required = registered == null ? null : policy === "remove" && active != null ? active : policy === "keep" ? registered : manyInactive ? null : registered;
  const ledger: QuantityLedger = {
    unitPlural: "usuários",
    rows: [
      { key: "contracted", label: "Licenças contratadas", value: contracted || null },
      { key: "registered", label: "Cadastrados", value: registered },
      { key: "active", label: "Ativos (90 dias)", value: active },
      { key: "required", label: "Necessário", value: required ?? maxReq, emphasis: true },
      { key: "growth", label: "Crescimento previsto", value: growth || null },
    ],
    difference: null,
  };
  const common = {
    familyId: pack.id,
    dimension: "quantity" as const,
    affected: baseItems.map((i) => i.effectiveSku),
    rule: { id: "QTY-03", name: "Licenças por usuário" },
    sourceIds: pack.sources.filter((s) => s.official).map((s) => s.id).slice(0, 1),
    evidence,
    ledger,
    key: `${pack.id}:QTY-03`,
  };

  if (registered == null || contracted === 0) {
    findings.push({
      ...common,
      verdict: "UNDETERMINED",
      severity: "info",
      title: contracted === 0 ? "Nenhuma licença de usuário na lista" : "Quantidade não avaliada: falta o total de usuários",
      explanation: "Sem licenças e usuários cadastrados não dá para comparar. Use o relatório de usuários do painel do fabricante.",
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Pedir o relatório de usuários e a lista de licenças." },
      confidence: "low",
    });
    return { findings, pending };
  }

  const effect = { kind: "quantity" as const, required: required ?? Math.min(Math.max(contracted, minReq ?? 0), maxReq ?? contracted), contracted, growth };

  if (required == null) {
    ledger.difference = null;
    findings.push({
      ...common,
      verdict: "NEEDS_VALIDATION",
      severity: "attention",
      title: `${registered - (active ?? registered)} usuários inativos: não reduzir sem política`,
      explanation: `Há ${registered} usuários cadastrados e ${active} ativos. O motor não recomenda automaticamente ${active} licenças. Antes, confirme a política para usuários inativos, a necessidade de contingência, o crescimento e a métrica oficial do fabricante.`,
      recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Definir com o cliente a política para inativos e o crescimento esperado." },
      confidence,
      effect,
    });
    return { findings, pending };
  }

  const diff = contracted - required;
  ledger.difference = diff;
  if (diff === 0 || (diff > 0 && diff <= Math.max(5, Math.round(required * 0.02)))) {
    findings.push({
      ...common,
      verdict: "ADEQUATE",
      severity: "ok",
      title: `Quantidade adequada: ${contracted} licenças para ${required} usuários`,
      explanation: diff > 0 ? `Sobra de ${diff} licenças, dentro de uma margem operacional pequena.` : "As licenças cobrem exatamente os usuários necessários.",
      recommendation: { type: "RENEW_AS_IS", text: "Renovar a mesma quantidade." },
      confidence,
      effect,
    });
  } else if (diff > 0) {
    findings.push({
      ...common,
      verdict: "POSSIBLE_SURPLUS",
      severity: "opportunity",
      title: `${diff} licenças de usuário aparentemente excedentes`,
      explanation: `Contratadas ${contracted}, necessárias ${required}${policy === "remove" ? " considerando a remoção de inativos" : ""}.`,
      recommendation: { type: "ADJUST_QUANTITY", text: `Avaliar renovar ${required} licenças${growth ? ` mais o crescimento previsto de ${growth}` : ""}.` },
      confidence,
      effect,
    });
  } else {
    findings.push({
      ...common,
      verdict: "POSSIBLE_DEFICIT",
      severity: "critical",
      title: `Déficit potencial de ${-diff} licenças de usuário`,
      explanation: `Contratadas ${contracted}, necessárias ${required}.${policy !== "remove" && active != null && active <= contracted ? ` Removendo os inativos, ${active} usuários cabem nas licenças atuais.` : ""}`,
      recommendation: { type: "ADJUST_QUANTITY", text: `Incluir ${-diff} licenças ou remover usuários inativos antes da renovação.` },
      confidence,
      urgency: "high",
      effect,
    });
  }
  return { findings, pending };
}

/** QTY-02: assinaturas presas ao equipamento (firewalls). Uma conclusão por modelo. */
export function quantityAttached(ctx: FamilyContext): Out {
  const { pack } = ctx;
  const findings: Finding[] = [];
  const pending: PendingQuestion[] = [];
  const models = new Set<string>();
  for (const i of ctx.hardwareItems) if (i.model) models.add(i.model);
  for (const i of ctx.licenseItems) if (i.model) models.add(i.model);
  for (const a of ctx.input.answers) if (a.familyId === pack.id && a.model && a.questionKey === Q.unitsInstalled) models.add(a.model);

  const sparesLicensed = ctx.str(Q.sparesLicensed) ?? "unknown";
  const addonName = (k: string) =>
    pack.addons?.find((a) => a.id === k)?.name ?? (k === "protection" ? "Bundle de proteção ou suporte" : k === "elite" ? "Upgrade FortiCare Elite" : k);

  for (const model of [...models].sort()) {
    const hw = ctx.hardwareItems.filter((i) => i.model === model);
    const lic = ctx.licenseItems.filter((i) => i.model === model);
    const hwDoc = sumQty(hw);
    const installed = ctx.num(Q.unitsInstalled, model) ?? (hwDoc > 0 ? hwDoc : null);
    const active = ctx.num(Q.unitsActive, model);
    const spare = ctx.num(Q.unitsSpare, model) ?? 0;
    const haSec = ctx.num(Q.unitsHaSecondary, model) ?? 0;

    if (active == null) pending.push(pendingFor(ctx, Q.unitsActive, "Quantos equipamentos deste modelo estão em produção.", model));
    const baseUnits = active ?? installed;
    if (baseUnits == null) {
      findings.push({
        key: `${pack.id}:QTY-02:${model}`,
        familyId: pack.id,
        dimension: "quantity",
        verdict: "UNDETERMINED",
        severity: "info",
        title: `${model}: quantidade de equipamentos não informada`,
        explanation: "Há assinaturas para este modelo, mas a lista não traz os equipamentos e não há resposta sobre o parque.",
        recommendation: { type: "COLLECT_MORE_INFORMATION", text: "Informar quantos equipamentos deste modelo existem e estão em produção." },
        affected: lic.map((i) => i.effectiveSku),
        rule: { id: "QTY-02", name: "Assinaturas por equipamento" },
        evidence: [ev("Assinaturas na lista", sumQty(lic), "documented")],
        sourceIds: [],
        confidence: "low",
      });
      pending.push(pendingFor(ctx, Q.unitsInstalled, "Sem o parque deste modelo não dá para conferir as assinaturas.", model));
      continue;
    }
    const required = baseUnits + (sparesLicensed === "yes" ? spare : 0);
    const counts = new Map<string, number>();
    for (const i of lic) for (const k of coverageKeys(i)) counts.set(k, (counts.get(k) ?? 0) + i.quantity);
    if (counts.size === 0) continue; // sem assinaturas: tratado pela regra de cobertura

    const parts: string[] = [];
    let worst: "ok" | "surplus" | "deficit" = "ok";
    const rows: QuantityLedger["rows"] = [
      { key: "installed", label: "Instalados", value: installed },
      { key: "active", label: "Em produção", value: active },
      { key: "ha", label: "Secundárias de HA", value: haSec || null },
      { key: "spare", label: "Contingência", value: spare || null },
      { key: "required", label: "Necessário por assinatura", value: required, emphasis: true },
    ];
    for (const [k, c] of counts) {
      const d = c - required;
      rows.push({ key: `svc-${k}`, label: addonName(k), value: c });
      if (d < 0) worst = "deficit";
      else if (d > 0 && worst !== "deficit") worst = "surplus";
      parts.push(`${addonName(k)}: ${c}${d === 0 ? "" : d > 0 ? ` (sobram ${d})` : ` (faltam ${-d})`}`);
    }
    const confidence = capForDraft(
      minConfidence(ORIGIN_CONFIDENCE[active != null ? originOf(ctx.answer(Q.unitsActive, model)) : "declared"], "medium"),
      lic.some((i) => i.record?.status === "draft"),
    );
    const haNote = haSec > 0 && pack.hints?.ha ? ` ${pack.hints.ha}` : "";
    const assumed = active == null ? " Considerando todos os instalados em produção até confirmação." : "";
    const base = {
      key: `${pack.id}:QTY-02:${model}`,
      familyId: pack.id,
      dimension: "quantity" as const,
      affected: lic.map((i) => i.effectiveSku),
      rule: { id: "QTY-02", name: "Assinaturas por equipamento" },
      evidence: [
        ev("Equipamentos", installed, ctx.answer(Q.unitsInstalled, model) ? originOf(ctx.answer(Q.unitsInstalled, model)) : "documented"),
        ev("Em produção", active, originOf(ctx.answer(Q.unitsActive, model))),
        ev("Assinaturas", parts.join("; "), "documented"),
      ],
      sourceIds: pack.rules.filter((r) => /-01$/.test(r.id)).flatMap((r) => r.sourceIds),
      confidence,
      ledger: { unitPlural: "equipamentos", rows, difference: null },
      effect: { kind: "quantity" as const, required, contracted: Math.min(...counts.values()), growth: 0 },
    };
    if (worst === "ok") {
      findings.push({ ...base, verdict: active == null ? "NEEDS_VALIDATION" : "ADEQUATE", severity: active == null ? "attention" : "ok", title: `${model}: assinaturas cobrem os ${required} equipamentos`, explanation: `${parts.join("; ")}.${assumed}${haNote}`, recommendation: { type: "RENEW_AS_IS", text: "Renovar as mesmas assinaturas por equipamento." } });
    } else if (worst === "surplus") {
      findings.push({ ...base, verdict: "POSSIBLE_SURPLUS", severity: "opportunity", title: `${model}: assinaturas acima do número de equipamentos`, explanation: `Necessário ${required} por assinatura. ${parts.join("; ")}.${assumed}${haNote}`, recommendation: { type: "ADJUST_QUANTITY", text: `Ajustar cada assinatura para ${required} unidades, após confirmar equipamentos desativados.` } });
    } else {
      findings.push({ ...base, verdict: "POSSIBLE_DEFICIT", severity: "critical", urgency: "high", title: `${model}: equipamentos sem todas as assinaturas`, explanation: `Necessário ${required} por assinatura. ${parts.join("; ")}.${assumed}${haNote}`, recommendation: { type: "ADD_COVERAGE", text: `Completar as assinaturas para ${required} unidades.` } });
    }
  }
  return { findings, pending };
}
