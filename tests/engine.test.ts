import { describe, expect, it } from "vitest";
import type { AnalysisInput, AnalysisItem, Answer } from "@/domain/types";
import { runAnalysis } from "@/engine/run";
import { resolveItems } from "@/engine/match";
import { extractFromText } from "@/engine/extract";
import { demoCollected, toAnalysisData, parseMerakiDate, collectMeraki } from "@/connectors/meraki";
import { addMonths, monthsBetween, parseLooseDate } from "@/lib/dates";
import { applyMapping, guessMapping, parseNumber } from "@/lib/import";

const TODAY = "2026-10-21";
let seq = 0;
function item(rawSku: string, quantity: number, extra: Partial<AnalysisItem> = {}): AnalysisItem {
  return { id: `i${++seq}`, rawSku, quantity, source: "manual", ...extra };
}
function ans(familyId: string, questionKey: string, value: unknown, extra: Partial<Answer> = {}): Answer {
  return { familyId, questionKey, value: typeof value === "string" ? value : JSON.stringify(value), origin: "declared", ...extra };
}
function input(items: AnalysisItem[], answers: Answer[] = [], extra: Partial<AnalysisInput> = {}): AnalysisInput {
  return { id: "a1", renewalDate: "2027-01-19", termMonths: 36, declaredFamilies: [], items, answers, reviews: {}, prices: {}, today: TODAY, ...extra };
}
const fam = (r: ReturnType<typeof runAnalysis>, id: string) => r.families.find((f) => f.familyId === id)!;
const byRule = (r: ReturnType<typeof runAnalysis>, id: string, rule: string) => fam(r, id).findings.filter((f) => f.rule.id === rule);

describe("datas e importação", () => {
  it("soma meses respeitando fim de mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2027-01-19", 36)).toBe("2030-01-19");
    expect(monthsBetween("2027-01-19", "2031-12-31")).toBe(59);
  });
  it("lê datas de planilhas brasileiras e do Excel", () => {
    expect(parseLooseDate("15/01/2027")).toBe("2027-01-15");
    expect(parseLooseDate("2027-01-15T00:00:00Z")).toBe("2027-01-15");
    expect(parseLooseDate(46402)).toBe("2027-01-15");
    expect(parseMerakiDate("Mar 13, 2027 UTC")).toBe("2027-03-13");
  });
  it("lê números em formato brasileiro e americano", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("120")).toBe(120);
    expect(parseNumber("US$ 6,00")).toBe(6);
  });
  it("sugere mapeamento de colunas em português e inglês", () => {
    const m = guessMapping(["Part Number", "Descrição", "Qtd", "Serial", "Vencimento", "Contrato"]);
    expect(m).toMatchObject({ sku: 0, description: 1, quantity: 2, serial: 3, endDate: 4, contractNumber: 5 });
    const rows = applyMapping([["LIC-ENT-3YR", "Licença", "120", "", "15/01/2027", "C-1"]], m);
    expect(rows[0]).toMatchObject({ rawSku: "LIC-ENT-3YR", quantity: 120, endDate: "2027-01-15" });
  });
  it("usa a coluna Model do inventário Meraki como SKU", () => {
    const m = guessMapping(["Name", "Serial number", "MAC address", "Model", "Network"]);
    expect(m.sku).toBe(3);
    expect(m.serial).toBe(1);
  });
});

describe("reconhecimento de itens", () => {
  it("separa reconhecido, parcial, duplicado, inconsistente e desconhecido", () => {
    const r = resolveItems([
      item("lic-ent-3yr", 10),
      item("FC-10-0060F-950-02-36", 2),
      item("PAN-PA-850-ATP-3YR-R", 2),
      item("CPAP-SG3600", 1),
      item("ZZZ", 1),
      item("MR42-HW", 1, { serial: "Q2KD-1" }),
      item("MR42-HW", 1, { serial: "q2kd-1" }),
      item("LIC-MR-ADV-3Y", 0),
      item("LIC-ENT-3YR-R", 5),
    ]);
    expect(r.map((x) => x.status)).toEqual(["recognized", "recognized", "recognized", "partial", "unrecognized", "recognized", "duplicate", "inconsistent", "partial"]);
    expect(r[1].record?.tierId).toBe("utp");
    expect(r[1].model).toBe("FG-60F");
    expect(r[2].record?.entitlements).toEqual(["ATP"]);
    expect(r[2].record?.termMonths).toBe(36);
    expect(r[3].vendorName).toBe("Check Point");
  });
});

describe("Meraki MR: exemplo do documento (120 APs, Advanced, 20 perto do fim de vida)", () => {
  const items = [
    item("LIC-MR-ADV-3Y", 120, { endDate: "2027-01-19" }),
    item("MR36-HW", 100),
    item("MR42-HW", 20),
  ];
  const base = [
    ans("cisco-meraki-mr", "units.active", "115"),
    ans("cisco-meraki-mr", "units.spare", "5"),
    ans("cisco-meraki-mr", "features.used", ["standard", "live-protect"]),
    ans("cisco-meraki-mr", "features.planned", ["adaptive-policy"]),
  ];

  it("quantidade coerente se a contingência precisar de licença", () => {
    const r = runAnalysis(input(items, base));
    const q = byRule(r, "cisco-meraki-mr", "QTY-01")[0];
    expect(q.verdict).toBe("NEEDS_VALIDATION");
    expect(fam(r, "cisco-meraki-mr").pending.map((p) => p.questionKey)).toContain("spares.licensed");
  });

  it("não recomenda downgrade antes do projeto de segmentação", () => {
    const r = runAnalysis(input(items, base));
    const t = byRule(r, "cisco-meraki-mr", "TIER-01")[0];
    expect(t.verdict).toBe("ADEQUATE");
    expect(t.explanation).toMatch(/Não realizar downgrade/);
    const a = byRule(r, "cisco-meraki-mr", "ADOPT-01")[0];
    expect(a.verdict).toBe("ADOPTION_OPPORTUNITY");
  });

  it("aponta MR42 fora de suporte e MR36 com fim de venda anunciado", () => {
    const r = runAnalysis(input(items, base));
    const life = fam(r, "cisco-meraki-mr").findings.filter((f) => f.dimension === "lifecycle");
    expect(life.find((f) => f.key.endsWith(":MR42"))?.verdict).toBe("END_OF_SUPPORT");
    expect(life.find((f) => f.key.endsWith(":MR36"))?.verdict).toBe("EOS_ANNOUNCED");
    expect(r.summary.lifecycleAttention).toBeGreaterThanOrEqual(2);
  });

  it("renovação de 60 meses passa do fim de suporte do MR36 e limita o prazo a 36", () => {
    const r = runAnalysis(input(items, base, { termMonths: 60 }));
    const f = fam(r, "cisco-meraki-mr").findings.find((x) => x.key === "cisco-meraki-mr:LIFE:MR36")!;
    expect(f.verdict).toBe("RENEWAL_RESTRICTED");
    expect(f.effect).toEqual({ kind: "term-cap", maxTermMonths: 36 });
  });

  it("com contingência sem licença, recomenda 115 e o cenário otimizado usa 115", () => {
    const r = runAnalysis(input(items, [...base, ans("cisco-meraki-mr", "spares.licensed", "no")]));
    const q = byRule(r, "cisco-meraki-mr", "QTY-01")[0];
    expect(q.verdict).toBe("POSSIBLE_SURPLUS");
    expect(q.ledger?.difference).toBe(5);
    const opt = r.scenarios.find((s) => s.id === "optimized")!;
    expect(opt.lines.find((l) => l.sku === "LIC-MR-ADV-3Y")?.quantity).toBe(115);
    const eq = r.scenarios.find((s) => s.id === "equivalent")!;
    expect(eq.lines.find((l) => l.sku === "LIC-MR-ADV-3Y")?.quantity).toBe(120);
  });

  it("cenário de refresh troca os MR42 pelo sucessor e inclui serviço", () => {
    const r = runAnalysis(input(items, base));
    const ref = r.scenarios.find((s) => s.id === "refresh")!;
    expect(ref.lines.find((l) => l.sku === "CW9172I-RTG")?.quantity).toBe(20);
    expect(ref.lines.some((l) => l.sku === "A-DEFINIR-SERVICO-CISCO")).toBe(true);
  });

  it("revisor rejeita o refresh: cenário deixa de incluir o sucessor", () => {
    const r1 = runAnalysis(input(items, base));
    const key = fam(r1, "cisco-meraki-mr").findings.find((f) => f.verdict === "END_OF_SUPPORT")!.key;
    const r2 = runAnalysis(input(items, base, { reviews: { [key]: { decision: "rejected" } } }));
    expect(r2.scenarios.find((s) => s.id === "refresh")!.lines.some((l) => l.sku === "CW9172I-RTG")).toBe(false);
  });

  it("upgrade obrigatório quando recurso em uso não está no nível", () => {
    const r = runAnalysis(
      input([item("LIC-ENT-3YR", 50), item("MR36-HW", 50)], [ans("cisco-meraki-mr", "units.active", "50"), ans("cisco-meraki-mr", "features.used", ["adaptive-policy"])]),
    );
    const t = byRule(r, "cisco-meraki-mr", "TIER-01")[0];
    expect(t.verdict).toBe("UPGRADE_REQUIRED");
    expect(r.scenarios.find((s) => s.id === "optimized")!.lines[0].sku).toBe("LIC-MR-ADV-3Y");
  });

  it("MR Upgrade diferente do limite Enterprise é dependência crítica", () => {
    const r = runAnalysis(input([item("LIC-ENT-3YR", 50), item("LIC-MR-UPGR-3Y", 40)]));
    expect(byRule(r, "cisco-meraki-mr", "MR-02")[0].severity).toBe("critical");
  });
});

describe("Cisco Duo: usuários inativos", () => {
  const items = [item("DUO-ADVANTAGE", 500, { endDate: "2027-01-19" })];
  const base = [ans("cisco-duo", "users.registered", "520"), ans("cisco-duo", "users.active", "410"), ans("cisco-duo", "features.used", ["mfa", "sso"])];

  it("não reduz para 410 sem política para inativos", () => {
    const r = runAnalysis(input(items, base));
    expect(byRule(r, "cisco-duo", "QTY-03")[0].verdict).toBe("NEEDS_VALIDATION");
    expect(fam(r, "cisco-duo").pending.map((p) => p.questionKey)).toContain("inactive.policy");
  });

  it("com remoção de inativos, aponta excedente e downgrade para Essentials", () => {
    const r = runAnalysis(input(items, [...base, ans("cisco-duo", "inactive.policy", "remove")]));
    const q = byRule(r, "cisco-duo", "QTY-03")[0];
    expect(q.verdict).toBe("POSSIBLE_SURPLUS");
    expect(q.ledger?.difference).toBe(90);
    const t = byRule(r, "cisco-duo", "TIER-01")[0];
    expect(t.verdict).toBe("POSSIBLE_DOWNGRADE");
    expect(t.effect).toEqual({ kind: "tier", suggestedTierId: "ess" });
  });

  it("exige DUO-SUB no pedido e calcula preço de lista", () => {
    const r = runAnalysis(input(items, base));
    expect(fam(r, "cisco-duo").findings.some((f) => f.rule.id === "DEP-01" && f.severity === "attention")).toBe(true);
    const eq = r.scenarios.find((s) => s.id === "equivalent")!;
    expect(eq.lines.map((l) => l.sku)).toEqual(["DUO-ADVANTAGE", "DUO-SUB"]);
    expect(eq.lines[0].lineTotal).toBe(500 * 6 * 36);
  });

  it("downgrade só entra no cenário otimizado depois do aceite", () => {
    const answers = [...base, ans("cisco-duo", "inactive.policy", "remove")];
    const r1 = runAnalysis(input(items, answers));
    expect(r1.scenarios.find((s) => s.id === "optimized")!.lines[0].sku).toBe("DUO-ADVANTAGE");
    const key = byRule(r1, "cisco-duo", "TIER-01")[0].key;
    const r2 = runAnalysis(input(items, answers, { reviews: { [key]: { decision: "accepted" } } }));
    const line = r2.scenarios.find((s) => s.id === "optimized")!.lines[0];
    expect(line).toMatchObject({ sku: "DUO-ESSENTIALS", quantity: 410 });
  });

  it("edição antiga vira migração", () => {
    const r = runAnalysis(input([item("DUO-ACCESS", 100)]));
    expect(byRule(r, "cisco-duo", "MIG-01")[0].recommendation?.type).toBe("MIGRATE_PRODUCT");
    expect(r.scenarios[0].lines[0].sku).toBe("DUO-ADVANTAGE");
  });
});

describe("Firewalls: Fortinet, Palo Alto e WatchGuard", () => {
  it("FortiGate: bundle UTP cobre 12 unidades e o ciclo de vida fica não confirmado", () => {
    const r = runAnalysis(
      input([item("FG-60F", 12), item("FC-10-0060F-950-02-12", 12, { endDate: "2027-01-19" })], [ans("fortinet-fortigate", "units.active", "12", { model: "FG-60F" }), ans("fortinet-fortigate", "features.used", ["ips", "web-filtering"])]),
    );
    const f = fam(r, "fortinet-fortigate");
    expect(f.findings.find((x) => x.rule.id === "QTY-02")?.verdict).toBe("ADEQUATE");
    expect(f.findings.find((x) => x.rule.id === "TIER-01")?.verdict).toBe("ADEQUATE");
    expect(f.findings.find((x) => x.key === "fortinet-fortigate:LIFE:unknown")).toBeTruthy();
    expect(f.findings.find((x) => x.rule.id === "QTY-02")?.confidence).not.toBe("high");
    const opt = r.scenarios.find((s) => s.id === "optimized")!;
    expect(opt.lines[0]).toMatchObject({ sku: "FC-10-0060F-950-02-36", quantity: 12 });
  });

  it("Palo Alto: HA, assinatura faltando, URL com déficit e prazo limitado pelo fim de vida", () => {
    const r = runAnalysis(
      input(
        [item("PAN-PA-850", 2), item("PAN-PA-850-ATP-3YR-R", 2), item("PAN-PA-850-ADVURL-3YR-R", 1), item("PAN-SVC-PREM-850-3YR-R", 2)],
        [
          ans("paloalto-ngfw", "units.active", "2", { model: "PA-850" }),
          ans("paloalto-ngfw", "units.ha_secondary", "1", { model: "PA-850" }),
          ans("paloalto-ngfw", "features.used", ["threat-prevention", "url-filtering", "dns-security"]),
        ],
      ),
    );
    const f = fam(r, "paloalto-ngfw");
    expect(f.findings.find((x) => x.rule.id === "QTY-02")?.verdict).toBe("POSSIBLE_DEFICIT");
    expect(f.findings.find((x) => x.rule.id === "TIER-01")?.verdict).toBe("UPGRADE_REQUIRED");
    const life = f.findings.find((x) => x.key === "paloalto-ngfw:LIFE:PA-850")!;
    expect(life.verdict).toBe("RENEWAL_RESTRICTED");
    expect(life.effect).toEqual({ kind: "term-cap", maxTermMonths: 12 });
    const opt = r.scenarios.find((s) => s.id === "optimized")!;
    const skus = opt.lines.map((l) => `${l.quantity} ${l.sku}`);
    expect(skus).toContain("1 PAN-PA-850-ADVURL-R");
    expect(skus).toContain("1 PAN-PA-850-ADVURL-HA2-R");
    expect(skus).toContain("1 PAN-PA-850-DNS-R");
    expect(skus).toContain("2 PAN-SVC-PREM-850-R");
    const ref = r.scenarios.find((s) => s.id === "refresh")!;
    expect(ref.lines.some((l) => l.sku === "PAN-PA-1420" && l.quantity === 2)).toBe(true);
  });

  it("WatchGuard T35 fora de vida e sem assinatura: refresh para T45", () => {
    const r = runAnalysis(input([item("FIREBOX-T35", 3)], [ans("watchguard-firebox", "units.active", "3", { model: "T35" })]));
    const f = fam(r, "watchguard-firebox");
    expect(f.findings.find((x) => x.key === "watchguard-firebox:LIFE:T35")?.verdict).toBe("END_OF_SUPPORT");
    expect(f.findings.find((x) => x.rule.id === "COV-04")?.severity).toBe("critical");
  });

  it("WatchGuard T40 renovado depois da última data de renovação", () => {
    const r = runAnalysis(input([item("FIREBOX-T40", 2)], [], { renewalDate: "2027-08-01" }));
    expect(fam(r, "watchguard-firebox").findings.find((x) => x.key === "watchguard-firebox:LIFE:T40")?.verdict).toBe("REFRESH_REQUIRED");
  });
});

describe("itens sem pacote e texto colado", () => {
  it("itens desconhecidos não são descartados e entram nos cenários", () => {
    const r = runAnalysis(input([item("CPAP-SG3600-NGTX", 2), item("LIC-ENT-1YR", 10)]));
    expect(r.general.find((g) => g.rule.id === "DATA-01")?.explanation).toMatch(/Check Point/);
    expect(r.scenarios[0].lines.some((l) => l.sku === "CPAP-SG3600-NGTX" && l.familyId === "outros")).toBe(true);
  });

  it("extrai SKU, quantidade e vencimento de um e-mail", () => {
    const rows = extractFromText(
      [
        "Olá, segue a renovação:",
        "- 120 x LIC-MR-ADV-3Y, vencimento 19/01/2027",
        "FC-10-0060F-950-02-12  qtd 12",
        "DUO-ADVANTAGE 500 licenças",
        "Obrigado!",
      ].join("\n"),
    );
    expect(rows.map((r) => [r.rawSku, r.quantity, r.endDate])).toEqual([
      ["LIC-MR-ADV-3Y", 120, "2027-01-19"],
      ["FC-10-0060F-950-02-12", 12, null],
      ["DUO-ADVANTAGE", 500, null],
    ]);
  });
});

describe("conector Meraki", () => {
  it("transforma a coleta em evidência coletada", () => {
    const data = toAnalysisData(demoCollected(TODAY));
    expect(data.items).toHaveLength(120);
    const get = (k: string, model?: string) => data.answers.find((a) => a.questionKey === k && (a.model ?? undefined) === model)?.value;
    expect(get("units.active")).toBe("115");
    expect(get("units.spare")).toBe("5");
    expect(get("spares.licensed")).toBe("no");
    expect(get("licenses.contracted")).toBe("120");
    expect(get("eox.endOfSupportAt", "MR42")).toBe("2026-07-21");
  });

  it("com dados coletados, a quantidade fecha em 115 com confiança alta", () => {
    const data = toAnalysisData(demoCollected(TODAY));
    const items = [item("LIC-MR-ADV-3Y", 120), ...data.items.map((d) => item(d.rawSku, d.quantity, { serial: d.serial, source: d.source }))];
    const answers = data.answers.map((a) => ({ ...a, value: a.value }));
    const r = runAnalysis(input(items, answers));
    const q = byRule(r, "cisco-meraki-mr", "QTY-01")[0];
    expect(q.verdict).toBe("POSSIBLE_SURPLUS");
    expect(q.confidence).toBe("high");
  });

  it("pagina e lê a API com fetch simulado", async () => {
    const demo = demoCollected(TODAY);
    const routes: Record<string, unknown> = {
      "/organizations/1": { id: "1", name: "Org" },
      "/organizations/1/inventory/devices": demo.devices.slice(0, 3).map((d) => ({ serial: d.serial, model: d.model, sku: d.sku, networkId: d.networkId, eox: d.eox })),
      "/organizations/1/devices/statuses": [{ serial: demo.devices[0].serial, status: "online" }],
      "/organizations/1/licenses/overview": { status: "OK", expirationDate: "Jan 19, 2027 UTC", licensedDeviceCounts: { MR: 120, MS: 10 } },
      "/organizations/1/licensing/coterm/licenses": [{ editions: [{ edition: "Advanced", productType: "wireless" }] }],
      "/organizations/1/adaptivePolicy/settings": { enabledNetworks: ["N_1"] },
    };
    const fetchImpl = (async (url: string) => {
      const path = new URL(url).pathname.replace("/api/v1", "");
      const body = routes[path];
      return new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const c = await collectMeraki({ apiKey: "x", orgId: "1", fetchImpl });
    expect(c.license).toMatchObject({ mode: "coterm", wirelessLimit: 120, edition: "Advanced", expirationDate: "2027-01-19" });
    expect(c.adaptivePolicyNetworks).toBe(1);
    expect(c.devices[0].status).toBe("online");
  });
});

describe("WatchGuard: padrão de part number", () => {
  it("reconhece a renovação TSS do T35 como rascunho e aponta renovação indisponível", () => {
    const r = runAnalysis(
      input([item("FIREBOX-T35", 3), item("WGT35353", 3, { endDate: "2026-11-30" })], [ans("watchguard-firebox", "units.active", "3", { model: "T35" })]),
    );
    expect(r.items[1].record).toMatchObject({ tierId: "tss", model: "T35", termMonths: 36, status: "draft" });
    const f = fam(r, "watchguard-firebox");
    expect(f.findings.some((x) => x.rule.id === "COV-04")).toBe(false);
    expect(f.findings.find((x) => x.key === "watchguard-firebox:LIFE:T35")?.verdict).toBe("END_OF_SUPPORT");
    const ref = r.scenarios.find((s) => s.id === "refresh")!;
    expect(ref.lines.map((l) => l.sku)).toEqual(expect.arrayContaining(["FIREBOX-T45", "WGT45353"]));
  });
});
