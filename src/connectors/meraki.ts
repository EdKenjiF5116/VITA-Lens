/**
 * Conector Meraki Dashboard API (beta).
 *
 * Transforma dados do Dashboard em evidência "coletada": inventário, APs em
 * rede x fora de rede (contingência), status, datas de EoX, limite de licenças
 * co-term e uso de Adaptive Policy.
 *
 * Endpoints (API v1):
 *  GET /organizations/{orgId}
 *  GET /organizations/{orgId}/inventory/devices?productTypes[]=wireless
 *  GET /organizations/{orgId}/devices/statuses?productTypes[]=wireless
 *  GET /organizations/{orgId}/licenses/overview
 *  GET /organizations/{orgId}/licensing/coterm/licenses
 *  GET /organizations/{orgId}/adaptivePolicy/settings
 *
 * O modo de demonstração usa dados simulados no mesmo formato da API.
 */
import { Q } from "@/packs/common";
import type { EvidenceOrigin } from "@/domain/types";

const BASE = "https://api.meraki.com/api/v1";
const FAMILY = "cisco-meraki-mr";

export interface MerakiDevice {
  serial: string;
  model: string;
  sku?: string;
  networkId: string | null;
  status?: string;
  eox?: { status: string | null; endOfSaleAt?: string | null; endOfSupportAt?: string | null };
}

export interface MerakiCollected {
  orgId: string;
  orgName: string;
  collectedAt: string;
  devices: MerakiDevice[];
  license: {
    mode: "coterm" | "other" | "unknown";
    status?: string;
    expirationDate?: string | null;
    wirelessLimit?: number | null;
    edition?: string | null;
  };
  adaptivePolicyNetworks: number | null;
  warnings: string[];
}

type Fetch = typeof fetch;

async function getAll<T>(path: string, apiKey: string, fetchImpl: Fetch): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `${BASE}${path}`;
  for (let page = 0; url && page < 20; page++) {
    const res: Response = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Meraki API ${res.status} em ${path}`);
    out.push(...((await res.json()) as T[]));
    const link = res.headers.get("link") ?? "";
    const next = /<([^>]+)>;\s*rel=next/.exec(link);
    url = next ? next[1] : null;
  }
  return out;
}

async function getOne<T>(path: string, apiKey: string, fetchImpl: Fetch): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Meraki API ${res.status} em ${path}`);
  return (await res.json()) as T;
}

const day = (v?: string | null) => (v ? v.slice(0, 10) : null);

export async function collectMeraki(opts: { apiKey: string; orgId: string; fetchImpl?: Fetch; now?: Date }): Promise<MerakiCollected> {
  const f = opts.fetchImpl ?? fetch;
  const { apiKey, orgId } = opts;
  const warnings: string[] = [];
  const org = await getOne<{ id: string; name: string }>(`/organizations/${orgId}`, apiKey, f);
  const inventory = await getAll<{
    serial: string;
    model: string;
    sku?: string;
    networkId: string | null;
    eox?: { status: string | null; endOfSaleAt?: string | null; endOfSupportAt?: string | null };
  }>(`/organizations/${orgId}/inventory/devices?productTypes[]=wireless&perPage=1000`, apiKey, f);

  let statuses: { serial: string; status: string }[] = [];
  try {
    statuses = await getAll(`/organizations/${orgId}/devices/statuses?productTypes[]=wireless&perPage=1000`, apiKey, f);
  } catch (e) {
    warnings.push(`Status dos equipamentos indisponível: ${(e as Error).message}`);
  }
  const statusBySerial = new Map(statuses.map((s) => [s.serial, s.status]));

  const license: MerakiCollected["license"] = { mode: "unknown" };
  try {
    const ov = await getOne<{ status?: string; expirationDate?: string; licensedDeviceCounts?: Record<string, number> }>(`/organizations/${orgId}/licenses/overview`, apiKey, f);
    if (ov.licensedDeviceCounts) {
      license.mode = "coterm";
      license.status = ov.status;
      license.expirationDate = parseMerakiDate(ov.expirationDate);
      const wireless = Object.entries(ov.licensedDeviceCounts).filter(([k]) => /^(MR|wireless)/i.test(k));
      license.wirelessLimit = wireless.length ? wireless.reduce((s, [, v]) => s + v, 0) : null;
    } else {
      license.mode = "other";
      warnings.push("Organização fora do modelo co-term. Limite de licenças não lido.");
    }
  } catch (e) {
    warnings.push(`Visão geral de licenças indisponível: ${(e as Error).message}`);
  }
  try {
    const lic = await getAll<{ editions?: { edition: string; productType: string }[]; expired?: boolean; invalidated?: boolean }>(`/organizations/${orgId}/licensing/coterm/licenses?perPage=1000`, apiKey, f);
    const editions = lic.filter((l) => !l.expired && !l.invalidated).flatMap((l) => l.editions ?? []).filter((e) => e.productType === "wireless");
    if (editions.length) license.edition = editions[0].edition;
  } catch {
    /* edição é opcional */
  }

  let adaptive: number | null = null;
  try {
    const ap = await getOne<{ enabledNetworks?: string[] }>(`/organizations/${orgId}/adaptivePolicy/settings`, apiKey, f);
    adaptive = ap.enabledNetworks?.length ?? 0;
  } catch {
    warnings.push("Configuração de Adaptive Policy indisponível.");
  }

  return {
    orgId: org.id,
    orgName: org.name,
    collectedAt: (opts.now ?? new Date()).toISOString(),
    devices: inventory.map((d) => ({ serial: d.serial, model: d.model, sku: d.sku, networkId: d.networkId, status: statusBySerial.get(d.serial), eox: d.eox })),
    license,
    adaptivePolicyNetworks: adaptive,
    warnings,
  };
}

/** O Dashboard devolve datas como "Mar 13, 2027 UTC" ou ISO. */
export function parseMerakiDate(v?: string | null): string | null {
  if (!v) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(v);
  if (iso) return iso[0];
  const t = Date.parse(v.replace(" UTC", " GMT"));
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export interface ProposedAnswer {
  familyId: string;
  model: string | null;
  questionKey: string;
  value: string;
  origin: EvidenceOrigin;
  evidence: string;
  merge?: "union";
}

export interface ProposedItem {
  rawSku: string;
  rawDescription: string;
  quantity: number;
  serial: string;
  source: string;
  sourceRef: string;
}

/** Converte a coleta em itens de inventário e respostas com origem "coletada". */
export function toAnalysisData(c: MerakiCollected): { items: ProposedItem[]; answers: ProposedAnswer[]; summary: string[] } {
  const when = c.collectedAt.slice(0, 10);
  const evidence = `Meraki Dashboard API, organização ${c.orgName}, ${when}`;
  const inNetwork = c.devices.filter((d) => d.networkId);
  const spare = c.devices.filter((d) => !d.networkId);
  const online = c.devices.filter((d) => d.status === "online" || d.status === "alerting");

  const items: ProposedItem[] = c.devices.map((d) => ({
    rawSku: d.sku || `${d.model}-HW`,
    rawDescription: `${d.model}${d.networkId ? "" : " (fora de rede)"}${d.status ? `, ${d.status}` : ""}`,
    quantity: 1,
    serial: d.serial,
    source: "meraki-api",
    sourceRef: `Meraki API, ${c.orgName}`,
  }));

  const a = (questionKey: string, value: string | number, extra = "", model: string | null = null, merge?: "union"): ProposedAnswer => ({
    familyId: FAMILY,
    model,
    questionKey,
    value: String(value),
    origin: "collected",
    evidence: extra ? `${evidence}. ${extra}` : evidence,
    merge,
  });

  const answers: ProposedAnswer[] = [
    a(Q.unitsInstalled, c.devices.length, "Inventário de wireless da organização."),
    a(Q.unitsActive, inNetwork.length, `APs adicionados a redes. ${online.length} online no momento da coleta.`),
    a(Q.unitsSpare, spare.length, "APs no inventário, fora de redes."),
    a(Q.unitsOnline, online.length),
  ];
  if (c.license.mode === "coterm") {
    answers.push(a(Q.sparesLicensed, "no", "No co-term, APs fora de rede não contam na licença."));
    if (c.license.wirelessLimit != null) answers.push(a(Q.licensesContracted, c.license.wirelessLimit, "Limite de licenças wireless no co-term."));
    if (c.license.expirationDate) answers.push(a(Q.licensesExpiration, c.license.expirationDate, "Data de co-term."));
    if (c.license.edition) answers.push(a(Q.licensesEdition, c.license.edition));
  }
  if (c.adaptivePolicyNetworks != null && c.adaptivePolicyNetworks > 0) {
    answers.push(a(Q.featuresUsed, JSON.stringify(["standard", "adaptive-policy"]), `Adaptive Policy ativo em ${c.adaptivePolicyNetworks} rede(s).`, null, "union"));
  }
  const eoxByModel = new Map<string, MerakiDevice["eox"]>();
  for (const d of c.devices) if (d.eox?.endOfSupportAt || d.eox?.endOfSaleAt) eoxByModel.set(d.model, d.eox);
  for (const [model, eox] of eoxByModel) {
    if (eox?.endOfSaleAt) answers.push(a(Q.eoxEndOfSale, day(eox.endOfSaleAt)!, "Campo eox do inventário.", model));
    if (eox?.endOfSupportAt) answers.push(a(Q.eoxEndOfSupport, day(eox.endOfSupportAt)!, "Campo eox do inventário.", model));
  }

  const byModel = new Map<string, number>();
  for (const d of c.devices) byModel.set(d.model, (byModel.get(d.model) ?? 0) + 1);
  const summary = [
    `${c.devices.length} APs no inventário (${[...byModel].map(([m, n]) => `${n} ${m}`).join(", ")}).`,
    `${inNetwork.length} em redes, ${spare.length} fora de rede, ${online.length} online.`,
    c.license.mode === "coterm"
      ? `Co-term: limite de ${c.license.wirelessLimit ?? "?"} licenças wireless${c.license.edition ? `, edição ${c.license.edition}` : ""}, vence em ${c.license.expirationDate ?? "data não informada"}.`
      : "Licenciamento fora do co-term.",
    c.adaptivePolicyNetworks ? `Adaptive Policy ativo em ${c.adaptivePolicyNetworks} rede(s).` : "Adaptive Policy sem redes ativas.",
    ...c.warnings,
  ];
  return { items, answers, summary };
}

/** Dados simulados no formato da API, para demonstração sem credenciais. */
export function demoCollected(today: string): MerakiCollected {
  const exp = new Date(Date.parse(today + "T00:00:00Z") + 88 * 86_400_000).toISOString().slice(0, 10);
  const devices: MerakiDevice[] = [];
  const pad = (n: number) => String(n).padStart(4, "0");
  for (let i = 0; i < 100; i++) {
    devices.push({ serial: `Q3AB-${pad(i)}-DEMO`, model: "MR36", sku: "MR36-HW", networkId: `N_${100 + (i % 6)}`, status: i % 33 === 0 ? "offline" : "online", eox: { status: "endOfSale", endOfSaleAt: "2026-12-31T00:00:00Z", endOfSupportAt: "2031-12-31T00:00:00Z" } });
  }
  for (let i = 0; i < 20; i++) {
    devices.push({ serial: `Q2KD-${pad(i)}-DEMO`, model: "MR42", sku: "MR42-HW", networkId: i < 15 ? `N_${100 + (i % 6)}` : null, status: i < 15 ? "online" : "dormant", eox: { status: "endOfSupport", endOfSaleAt: "2022-07-14T00:00:00Z", endOfSupportAt: "2026-07-21T00:00:00Z" } });
  }
  return {
    orgId: "549236",
    orgName: "Construtora Horizonte (demonstração)",
    collectedAt: new Date(Date.parse(today + "T12:00:00Z")).toISOString(),
    devices,
    license: { mode: "coterm", status: "OK", expirationDate: exp, wirelessLimit: 120, edition: "Advanced" },
    adaptivePolicyNetworks: 0,
    warnings: ["Dados simulados no formato da Meraki Dashboard API."],
  };
}
