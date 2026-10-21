import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { addDays, addMonths, todayIso } from "@/lib/dates";

type DB = PgliteDatabase<typeof schema>;
const id = () => crypto.randomUUID();

/**
 * Dados de demonstração. Datas relativas a hoje para que vencimentos e
 * prazos continuem fazendo sentido em qualquer dia em que o protótipo rodar.
 * Clientes fictícios.
 */
export async function seedIfEmpty(db: DB) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.clients);
  if (n > 0) return;
  await seedDemo(db);
}

export async function seedDemo(db: DB, today = todayIso()) {
  const c1 = id();
  const c2 = id();
  await db.insert(schema.clients).values([
    {
      id: c1,
      name: "Construtora Horizonte S.A.",
      tradeName: "Horizonte",
      sector: "Construção civil",
      sites: 8,
      region: "São Paulo, SP",
      criticality: "Alta",
      salesOwner: "Equipe comercial",
      technicalOwner: "Pré-vendas",
      contact: "TI corporativa",
    },
    {
      id: c2,
      name: "Rede Varejista Atlântico Ltda.",
      tradeName: "Atlântico",
      sector: "Varejo",
      sites: 42,
      region: "Sudeste",
      criticality: "Média",
      salesOwner: "Equipe comercial",
      technicalOwner: "Pré-vendas",
      contact: "Infraestrutura e segurança",
    },
  ]);

  /* ---- Análise 1: wireless Meraki (exemplo do documento de produto) ---- */
  const a1 = id();
  const r1 = addDays(today, 90);
  await db.insert(schema.analyses).values({
    id: a1,
    clientId: c1,
    name: "Renovação wireless matriz e obras",
    status: "COLLECTING_DATA",
    renewalDate: r1,
    proposalDue: addDays(today, 30),
    termMonths: 36,
    objective: "Renovar licenças Meraki MR e avaliar refresh dos APs antigos.",
    distributor: "Distribuidor Cisco",
    owner: "Pré-vendas",
    declaredFamilies: ["cisco-meraki-mr"],
  });
  const f1 = "renovacao_horizonte.xlsx";
  await db.insert(schema.items).values([
    { id: id(), analysisId: a1, position: 1, rawSku: "LIC-MR-ADV-3Y", rawDescription: "Meraki MR Advanced License, 3 Years", quantity: 120, contractNumber: "CTR-88412", startDate: addMonths(r1, -36), endDate: r1, source: "xlsx", sourceRef: `${f1}, linha 2` },
    { id: id(), analysisId: a1, position: 2, rawSku: "MR36-HW", rawDescription: "Meraki MR36 Wi-Fi 6 Indoor AP", quantity: 100, source: "xlsx", sourceRef: `${f1}, linha 3` },
    { id: id(), analysisId: a1, position: 3, rawSku: "MR42-HW", rawDescription: "Meraki MR42 Cloud Managed AP", quantity: 20, source: "xlsx", sourceRef: `${f1}, linha 4` },
    { id: id(), analysisId: a1, position: 4, rawSku: "MA-INJ-5-BR", rawDescription: "Injetor PoE", quantity: 5, source: "xlsx", sourceRef: `${f1}, linha 5` },
  ]);
  const declared = { origin: "declared", author: "Pré-vendas", evidence: "Reunião com a TI do cliente" };
  await db.insert(schema.answers).values([
    { id: id(), analysisId: a1, familyId: "cisco-meraki-mr", model: "", questionKey: "units.active", value: "115", ...declared },
    { id: id(), analysisId: a1, familyId: "cisco-meraki-mr", model: "", questionKey: "units.spare", value: "5", ...declared },
    { id: id(), analysisId: a1, familyId: "cisco-meraki-mr", model: "", questionKey: "features.used", value: JSON.stringify(["standard", "live-protect", "spaces-essentials"]), ...declared },
    { id: id(), analysisId: a1, familyId: "cisco-meraki-mr", model: "", questionKey: "features.planned", value: JSON.stringify(["adaptive-policy"]), ...declared, evidence: "Projeto de segmentação em avaliação para 2027" },
    { id: id(), analysisId: a1, familyId: "cisco-meraki-mr", model: "", questionKey: "growth.units", value: "10", ...declared, evidence: "Duas obras novas previstas" },
  ]);

  /* ---- Análise 2: perímetro e identidade, vários fabricantes ---- */
  const a2 = id();
  const r2 = addDays(today, 75);
  await db.insert(schema.analyses).values({
    id: a2,
    clientId: c2,
    name: "Segurança de perímetro e identidade",
    status: "COLLECTING_DATA",
    renewalDate: r2,
    proposalDue: addDays(today, 20),
    termMonths: 36,
    objective: "Consolidar renovações de firewall e MFA das lojas e da matriz.",
    owner: "Pré-vendas",
    declaredFamilies: [],
  });
  const f2 = "contratos_atlantico.csv";
  const rows2: [string, string, number, string | null][] = [
    ["FG-60F", "FortiGate 60F (lojas)", 12, null],
    ["FC-10-0060F-950-02-12", "FortiGate 60F UTP 1 ano", 10, r2],
    ["FC-10-0060F-950-02-12", "FortiGate 60F UTP 1 ano (lojas novas)", 2, addDays(today, 200)],
    ["FG-100F", "FortiGate 100F (matriz, HA)", 2, null],
    ["FC-10-F100F-928-02-12", "FortiGate 100F ATP 1 ano", 2, r2],
    ["PAN-PA-850", "PA-850 data center (HA)", 2, null],
    ["PAN-PA-850-ATP-3YR", "Advanced Threat Prevention 3 anos", 1, r2],
    ["PAN-PA-850-ATP-HA2-3YR", "Advanced Threat Prevention HA 3 anos", 1, r2],
    ["PAN-PA-850-ADVURL-3YR", "Advanced URL Filtering 3 anos", 1, r2],
    ["PAN-SVC-PREM-850-3YR", "Premium Support 3 anos", 2, r2],
    ["DUO-ADVANTAGE", "Duo Advantage", 500, r2],
    ["FIREBOX-T35", "Firebox T35 (quiosques)", 3, null],
    ["WGT35353", "Total Security Suite T35 3 anos", 3, addDays(today, 40)],
    ["CPAP-SG3600-NGTX", "Check Point 3600 (fábrica)", 1, addDays(today, 150)],
  ];
  await db.insert(schema.items).values(
    rows2.map(([sku, desc, qty, end], i) => ({
      id: id(),
      analysisId: a2,
      position: i + 1,
      rawSku: sku,
      rawDescription: desc,
      quantity: qty,
      endDate: end,
      source: "csv",
      sourceRef: `${f2}, linha ${i + 2}`,
    })),
  );
  const ans2: [string, string, string, string][] = [
    ["fortinet-fortigate", "FG-60F", "units.active", "12"],
    ["fortinet-fortigate", "FG-100F", "units.active", "2"],
    ["fortinet-fortigate", "FG-100F", "units.ha_secondary", "1"],
    ["fortinet-fortigate", "", "features.used", JSON.stringify(["app-control", "ips", "amp", "web-filtering"])],
    ["paloalto-ngfw", "PA-850", "units.active", "2"],
    ["paloalto-ngfw", "PA-850", "units.ha_secondary", "1"],
    ["paloalto-ngfw", "", "features.used", JSON.stringify(["threat-prevention", "url-filtering"])],
    ["cisco-duo", "", "users.registered", "520"],
    ["cisco-duo", "", "users.active", "410"],
    ["cisco-duo", "", "features.used", JSON.stringify(["mfa", "sso", "trusted-endpoints"])],
    ["watchguard-firebox", "T35", "units.active", "3"],
  ];
  await db.insert(schema.answers).values(
    ans2.map(([familyId, model, questionKey, value]) => ({ id: id(), analysisId: a2, familyId, model, questionKey, value, ...declared, evidence: "Planilha de inventário do cliente" })),
  );

  /* ---- Análise 3: rascunho vazio, para mostrar o início do fluxo ---- */
  const a3 = id();
  await db.insert(schema.analyses).values({
    id: a3,
    clientId: c1,
    name: "Wireless canteiros (Aruba)",
    status: "DRAFT",
    renewalDate: addDays(today, 160),
    termMonths: 36,
    objective: "Avaliar renovação das assinaturas Aruba Central dos canteiros.",
    owner: "Pré-vendas",
    declaredFamilies: ["hpe-aruba-central-ap"],
  });

  await db.insert(schema.auditLog).values([
    { id: id(), analysisId: a1, action: "Análise criada", detail: "Dados de demonstração", actor: "VITA Lens" },
    { id: id(), analysisId: a1, action: "Importação", detail: `4 linhas de ${f1}`, actor: "Pré-vendas" },
    { id: id(), analysisId: a2, action: "Análise criada", detail: "Dados de demonstração", actor: "VITA Lens" },
    { id: id(), analysisId: a2, action: "Importação", detail: `${rows2.length} linhas de ${f2}`, actor: "Pré-vendas" },
    { id: id(), analysisId: a3, action: "Análise criada", detail: "Dados de demonstração", actor: "VITA Lens" },
  ]);
}
