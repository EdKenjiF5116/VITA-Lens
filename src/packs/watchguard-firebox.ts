import type { FamilyPack, HardwareModel, Lifecycle, SkuRecord, Source } from "@/domain/types";
import { attachedQuestions } from "./common";
import { addMonths } from "@/lib/dates";

const ACCESSED = "2026-10-21";

const sources: Source[] = [
  {
    id: "wg-eol",
    title: "End of Life Policy",
    publisher: "WatchGuard",
    url: "https://www.watchguard.com/wgrd-about/end-of-life-policy",
    accessedAt: ACCESSED,
    official: true,
  },
  {
    id: "wg-services",
    title: "Security Services (comparativo Basic Security e Total Security)",
    publisher: "WatchGuard",
    url: "https://www.watchguard.com/wgrd-products/security-services",
    accessedAt: ACCESSED,
    official: true,
  },
  {
    id: "wg-skus-resellers",
    title: "Listagens de revendas (WGT45351, WGT45353, WGT49341)",
    publisher: "Revendas (firewalls.com, bosspacific.com.au)",
    url: "https://www.firewalls.com/licensing/watchguard-firewalls/watchguard-firebox-t45.html",
    accessedAt: ACCESSED,
    official: false,
  },
];

const features = [
  { id: "ips", name: "Intrusion Prevention (IPS)", tiers: ["bss", "tss"], sourceIds: ["wg-services"] },
  { id: "app-control", name: "Application Control", tiers: ["bss", "tss"], sourceIds: ["wg-services"] },
  { id: "webblocker", name: "WebBlocker (filtro web)", tiers: ["bss", "tss"], sourceIds: ["wg-services"] },
  { id: "spamblocker", name: "spamBlocker", tiers: ["bss", "tss"], sourceIds: ["wg-services"] },
  { id: "gateway-av", name: "Gateway AntiVirus", tiers: ["bss", "tss"], sourceIds: ["wg-services"] },
  { id: "network-discovery", name: "Network Discovery", tiers: ["bss", "tss"], sourceIds: ["wg-services"] },
  { id: "apt-blocker", name: "APT Blocker (sandbox)", tiers: ["tss"], sourceIds: ["wg-services"] },
  { id: "dnswatch", name: "DNSWatch", tiers: ["tss"], sourceIds: ["wg-services"] },
  { id: "intelligentav", name: "IntelligentAV", tiers: ["tss"], description: "Não disponível em T20, T25, T35-R e T115-W.", sourceIds: ["wg-services"] },
  { id: "threatsync", name: "ThreatSync (XDR)", tiers: ["tss"], needsService: true, sourceIds: ["wg-services"] },
  { id: "edr-core", name: "EDR Core", tiers: ["tss"], needsService: true, sourceIds: ["wg-services"] },
  { id: "log-365", name: "Retenção de logs de 365 dias na WatchGuard Cloud", tiers: ["tss"], sourceIds: ["wg-services"] },
  { id: "gold-support", name: "Suporte Gold 24x7", tiers: ["tss"], sourceIds: ["wg-services"] },
];

/** Assinaturas renováveis são vendidas, em geral, até um ano antes do fim de vida. */
function eol(endOfSaleAt: string, endOfSupportAt: string): Lifecycle {
  return {
    endOfSaleAt,
    endOfSupportAt,
    lastRenewalAt: addMonths(endOfSupportAt, -12),
    sourceIds: ["wg-eol"],
    status: "validated",
    note: "Última renovação calculada pela política: assinaturas renováveis até um ano antes do fim de vida.",
  };
}
const ACTIVE: Lifecycle = { sourceIds: ["wg-eol"], status: "validated", note: "Modelo fora da lista de fim de vida consultada." };
const s = (model: string, note?: string) => ({ model, sku: `FIREBOX-${model}`, note: note ?? "Caminho de migração indicado pela WatchGuard.", status: "validated" as const });

const hardware: HardwareModel[] = [
  { model: "T15", skus: ["FIREBOX-T15"], description: "Firebox T15", lifecycle: eol("2022-03-01", "2027-03-01"), successors: [s("T25")] },
  { model: "T15-W", skus: ["FIREBOX-T15-W"], description: "Firebox T15 com Wi-Fi", lifecycle: eol("2022-03-01", "2027-03-01"), successors: [s("T25-W")] },
  { model: "T35", skus: ["FIREBOX-T35"], description: "Firebox T35", lifecycle: eol("2021-07-17", "2025-12-31"), successors: [s("T45")] },
  { model: "T35-W", skus: ["FIREBOX-T35-W"], description: "Firebox T35 com Wi-Fi", lifecycle: eol("2020-12-31", "2025-12-31"), successors: [s("T45-W-POE")] },
  { model: "T35-R", skus: ["FIREBOX-T35-R"], description: "Firebox T35-R (robusto)", lifecycle: eol("2023-07-01", "2027-03-01"), successors: [s("T45")] },
  { model: "T55", skus: ["FIREBOX-T55"], description: "Firebox T55", lifecycle: eol("2020-12-31", "2025-12-31"), successors: [s("T85-POE")] },
  { model: "T70", skus: ["FIREBOX-T70"], description: "Firebox T70", lifecycle: eol("2021-09-30", "2025-12-31"), successors: [s("T85-POE")] },
  { model: "T20", skus: ["FIREBOX-T20"], description: "Firebox T20", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("T25")] },
  { model: "T40", skus: ["FIREBOX-T40"], description: "Firebox T40", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("T45")] },
  { model: "T80", skus: ["FIREBOX-T80"], description: "Firebox T80", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("T85-POE")] },
  { model: "M270", skus: ["FIREBOX-M270"], description: "Firebox M270", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("M290")] },
  { model: "M370", skus: ["FIREBOX-M370"], description: "Firebox M370", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("M390")] },
  { model: "M470", skus: ["FIREBOX-M470"], description: "Firebox M470", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("M590")] },
  { model: "M570", skus: ["FIREBOX-M570"], description: "Firebox M570", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("M590")] },
  { model: "M670", skus: ["FIREBOX-M670"], description: "Firebox M670", lifecycle: eol("2023-07-01", "2028-07-01"), successors: [s("M690")] },
  { model: "T25", skus: ["FIREBOX-T25"], description: "Firebox T25", lifecycle: ACTIVE },
  { model: "T25-W", skus: ["FIREBOX-T25-W"], description: "Firebox T25 com Wi-Fi", lifecycle: ACTIVE },
  { model: "T45", skus: ["FIREBOX-T45"], description: "Firebox T45", lifecycle: ACTIVE },
  { model: "T45-W-POE", skus: ["FIREBOX-T45-W-POE"], description: "Firebox T45 com Wi-Fi e PoE", lifecycle: ACTIVE },
  { model: "T85-POE", skus: ["FIREBOX-T85-POE"], description: "Firebox T85 com PoE", lifecycle: ACTIVE },
  { model: "M290", skus: ["FIREBOX-M290"], description: "Firebox M290", lifecycle: ACTIVE },
  { model: "M390", skus: ["FIREBOX-M390"], description: "Firebox M390", lifecycle: ACTIVE },
  { model: "M590", skus: ["FIREBOX-M590"], description: "Firebox M590", lifecycle: ACTIVE },
  { model: "M690", skus: ["FIREBOX-M690"], description: "Firebox M690", lifecycle: ACTIVE },
];

const base = { vendor: "watchguard" as const, familyId: "watchguard-firebox" };

const skus: SkuRecord[] = [
  ...hardware.map<SkuRecord>((h) => ({
    ...base,
    sku: h.skus[0],
    aliases: [`FIREBOX ${h.model}`],
    category: "HARDWARE",
    kind: "hardware",
    model: h.model,
    description: h.description,
    status: "validated",
    sourceIds: ["wg-eol"],
  })),
  { ...base, sku: "WGT45351", category: "SECURITY_SERVICE", kind: "bundle", tierId: "tss", serviceKey: "protection", model: "T45", termMonths: 12, renewal: true, description: "Total Security Suite, renovação 1 ano, Firebox T45", status: "draft", sourceIds: ["wg-skus-resellers"] },
  { ...base, sku: "WGT45353", category: "SECURITY_SERVICE", kind: "bundle", tierId: "tss", serviceKey: "protection", model: "T45", termMonths: 36, renewal: true, description: "Total Security Suite, renovação 3 anos, Firebox T45", status: "draft", sourceIds: ["wg-skus-resellers"] },
  { ...base, sku: "WGT49341", category: "SECURITY_SERVICE", kind: "bundle", tierId: "bss", serviceKey: "protection", model: "T45-CW", termMonths: 12, renewal: true, description: "Basic Security Suite, renovação 1 ano, Firebox T45-CW", status: "draft", sourceIds: ["wg-skus-resellers"] },
];

const RENEWAL: Record<string, Record<string, Record<number, string>>> = {
  T45: { tss: { 12: "WGT45351", 36: "WGT45353" } },
  "T45-CW": { bss: { 12: "WGT49341" } },
};

/**
 * Padrão inferido dos part numbers de renovação da linha T: WGT + modelo (2 dígitos)
 * + suíte (34 = Basic, 35 = Total) + prazo (1 = 1 ano, 3 = 3 anos).
 * Confirmado só para T45 e T45-CW; demais modelos ficam como rascunho.
 */
const MODEL_DIGITS: Record<string, string> = { "49": "T45-CW" };
function parseWg(sku: string) {
  const m = /^WGT(\d{2})(34|35)([13])$/.exec(sku);
  if (!m) return null;
  const model = MODEL_DIGITS[m[1]] ?? `T${m[1]}`;
  const tierId = m[2] === "34" ? "bss" : "tss";
  const termMonths = m[3] === "1" ? 12 : 36;
  return { model, tierId, termMonths };
}

export const watchguardFirebox: FamilyPack = {
  id: "watchguard-firebox",
  vendor: "watchguard",
  vendorName: "WatchGuard",
  name: "WatchGuard Firebox",
  technology: "Firewall (UTM/NGFW)",
  metric: "HARDWARE_ATTACHED",
  unit: { singular: "firewall", plural: "firewalls" },
  tiers: [
    { id: "support", name: "Standard Support", rank: 1 },
    { id: "bss", name: "Basic Security Suite", rank: 2 },
    { id: "tss", name: "Total Security Suite", rank: 3 },
  ],
  features,
  hardware,
  skus,
  parseSku: (sku) => {
    const p = parseWg(sku);
    if (!p) return null;
    return {
      ...base,
      sku,
      category: "SECURITY_SERVICE",
      kind: "bundle",
      tierId: p.tierId,
      serviceKey: "protection",
      model: p.model,
      termMonths: p.termMonths,
      renewal: true,
      description: `${p.tierId === "tss" ? "Total Security Suite" : "Basic Security Suite"}, renovação ${p.termMonths / 12} ${p.termMonths === 12 ? "ano" : "anos"}, Firebox ${p.model} (padrão inferido)`,
      status: "draft",
      sourceIds: ["wg-skus-resellers"],
    };
  },
  renewalSku: ({ tierId, termMonths, model }) => {
    if (!model) return null;
    const known = RENEWAL[model]?.[tierId]?.[termMonths];
    if (known) return known;
    const digits = /^T(\d{2})$/.exec(model)?.[1];
    if (!digits || !["bss", "tss"].includes(tierId) || ![12, 36].includes(termMonths)) return null;
    return `WGT${digits}${tierId === "bss" ? "34" : "35"}${termMonths === 12 ? "1" : "3"}`;
  },
  supportedTerms: [12, 36],
  questions: attachedQuestions({ features, haHelp: "Informe quantas unidades atuam como secundárias em cluster." }),
  rules: [
    { id: "WG-01", name: "Renovação até um ano antes do fim de vida", description: "Assinaturas renováveis são vendidas, em geral, até um ano antes do EOL. Suporte e serviços não passam do EOL e não há co-term no último ano.", sourceIds: ["wg-eol"] },
    { id: "WG-02", name: "Fim de vida até cinco anos após fim de venda", description: "O EOL acontece em geral até cinco anos depois do fim de venda, com anúncio pelo menos 60 dias antes.", sourceIds: ["wg-eol"] },
  ],
  hints: {
    lifecycle: "Pela política da WatchGuard, assinaturas renováveis são vendidas em geral até um ano antes do fim de vida.",
  },
  sources,
  status: "validated",
  validatedAt: ACCESSED,
  validatedBy: "Pacote inicial VITA Lens",
  notes: [
    "Ciclo de vida e conteúdo das suítes validados em páginas oficiais.",
    "Part numbers de renovação confirmados só para T45 e T45-CW. Os demais seguem um padrão inferido e ficam como rascunho.",
  ],
};
