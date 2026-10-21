import type { FamilyPack, HardwareModel, SkuRecord, Source } from "@/domain/types";
import { attachedQuestions } from "./common";

const ACCESSED = "2026-10-21";

const sources: Source[] = [
  {
    id: "pan-eol",
    title: "Hardware End-of-Life Dates",
    publisher: "Palo Alto Networks",
    url: "https://www.paloaltonetworks.com/services/support/end-of-life-announcements/hardware-end-of-life-dates",
    accessedAt: ACCESSED,
    official: true,
  },
  {
    id: "pan-skus-resellers",
    title: "Listagens de revendas com part numbers PAN-PA-440 (ATP, ADVURL, HA2, BND-CORESEC)",
    publisher: "Revendas (connection.com)",
    url: "https://www.connection.com/product/palo-alto-palo-alto-networks-pa-440-advanced-threat-prevention-subscription-1-year-12-months-term-rene/pan-pa-440-atp-r/41653055",
    accessedAt: ACCESSED,
    official: false,
    note: "Padrão do part number inferido de listagens. Validar com a lista de preços.",
  },
];

const ADDONS = {
  ATP: "Advanced Threat Prevention",
  ADVURL: "Advanced URL Filtering",
  AWF: "Advanced WildFire",
  DNS: "DNS Security",
  GP: "GlobalProtect",
  SDWAN: "SD-WAN",
  PREM: "Premium Support",
} as const;

const features = [
  { id: "threat-prevention", name: "Prevenção de ameaças (IPS, antivírus, anti-spyware)", tiers: ["ATP"], sourceIds: ["pan-skus-resellers"] },
  { id: "url-filtering", name: "Filtro de URL", tiers: ["ADVURL"], sourceIds: ["pan-skus-resellers"] },
  { id: "sandbox", name: "Análise de arquivos em sandbox (WildFire)", tiers: ["AWF"], sourceIds: ["pan-skus-resellers"] },
  { id: "dns-security", name: "Segurança DNS", tiers: ["DNS"], sourceIds: ["pan-skus-resellers"] },
  { id: "gp-advanced", name: "GlobalProtect com verificação de postura (HIP)", tiers: ["GP"], description: "A VPN básica não exige assinatura. HIP e recursos avançados exigem.", sourceIds: ["pan-skus-resellers"] },
  { id: "sdwan", name: "SD-WAN", tiers: ["SDWAN"], sourceIds: ["pan-skus-resellers"] },
];

function eol(endOfSaleAt: string, endOfSupportAt: string) {
  return { endOfSaleAt, endOfSupportAt, sourceIds: ["pan-eol"], status: "validated" as const };
}
const ACTIVE = { sourceIds: ["pan-eol"], status: "validated" as const, note: "Modelo sem linha na página de fim de vida consultada." };
const succ = (model: string, note: string) => ({ model, sku: `PAN-${model}`, note, status: "draft" as const });

const hardware: HardwareModel[] = [
  { model: "PA-220", skus: ["PAN-PA-220"], description: "NGFW de entrada", lifecycle: eol("2023-01-31", "2028-01-31"), successors: [succ("PA-440", "Fabricante indica PA-400 ou PA-500. Modelo exato a dimensionar.")] },
  { model: "PA-220R", skus: ["PAN-PA-220R"], description: "NGFW robusto (industrial)", lifecycle: eol("2025-01-31", "2030-01-31"), successors: [succ("PA-450R", "Fabricante indica a série PA-400R.")] },
  { model: "PA-820", skus: ["PAN-PA-820"], description: "NGFW de filial", lifecycle: eol("2024-08-31", "2029-08-31"), successors: [succ("PA-1410", "Fabricante indica a série PA-1400.")] },
  { model: "PA-850", skus: ["PAN-PA-850"], description: "NGFW de filial", lifecycle: eol("2024-08-31", "2029-08-31"), successors: [succ("PA-1420", "Fabricante indica a série PA-1400.")] },
  { model: "PA-3220", skus: ["PAN-PA-3220"], description: "NGFW de campus", lifecycle: eol("2023-08-31", "2028-08-31"), successors: [succ("PA-3410", "Fabricante indica a série PA-3400.")] },
  { model: "PA-3250", skus: ["PAN-PA-3250"], description: "NGFW de campus", lifecycle: eol("2023-08-31", "2028-08-31"), successors: [succ("PA-3420", "Fabricante indica a série PA-3400.")] },
  { model: "PA-3260", skus: ["PAN-PA-3260"], description: "NGFW de campus", lifecycle: eol("2023-08-31", "2028-08-31"), successors: [succ("PA-3430", "Fabricante indica a série PA-3400.")] },
  { model: "PA-5220", skus: ["PAN-PA-5220"], description: "NGFW de data center", lifecycle: eol("2023-08-31", "2028-08-31"), successors: [succ("PA-5410", "Fabricante indica as séries PA-5400 ou PA-5500.")] },
  { model: "PA-410", skus: ["PAN-PA-410"], description: "NGFW de entrada", lifecycle: eol("2027-03-22", "2032-03-21"), successors: [succ("PA-510", "Fabricante indica a série PA-500. Modelo exato a dimensionar.")] },
  { model: "PA-440", skus: ["PAN-PA-440"], description: "NGFW de entrada", lifecycle: eol("2027-03-22", "2032-03-21"), successors: [succ("PA-510", "Fabricante indica a série PA-500. Modelo exato a dimensionar.")] },
  { model: "PA-450", skus: ["PAN-PA-450"], description: "NGFW de entrada", lifecycle: eol("2027-03-22", "2032-03-21"), successors: [succ("PA-520", "Fabricante indica a série PA-500. Modelo exato a dimensionar.")] },
  { model: "PA-460", skus: ["PAN-PA-460"], description: "NGFW de entrada", lifecycle: eol("2027-03-22", "2032-03-21"), successors: [succ("PA-530", "Fabricante indica a série PA-500. Modelo exato a dimensionar.")] },
  { model: "PA-1410", skus: ["PAN-PA-1410"], description: "NGFW de filial", lifecycle: ACTIVE },
  { model: "PA-1420", skus: ["PAN-PA-1420"], description: "NGFW de filial", lifecycle: ACTIVE },
  { model: "PA-3410", skus: ["PAN-PA-3410"], description: "NGFW de campus", lifecycle: ACTIVE },
  { model: "PA-3420", skus: ["PAN-PA-3420"], description: "NGFW de campus", lifecycle: ACTIVE },
  { model: "PA-3430", skus: ["PAN-PA-3430"], description: "NGFW de campus", lifecycle: ACTIVE },
];

const base = { vendor: "paloalto" as const, familyId: "paloalto-ngfw", status: "draft" as const };

const SUB_CODES: Record<string, { entitlements: string[]; legacyOf?: string; label: string }> = {
  ATP: { entitlements: ["ATP"], label: ADDONS.ATP },
  TP: { entitlements: ["ATP"], legacyOf: "ATP", label: "Threat Prevention (geração anterior)" },
  ADVURL: { entitlements: ["ADVURL"], label: ADDONS.ADVURL },
  URL4: { entitlements: ["ADVURL"], legacyOf: "ADVURL", label: "PAN-DB URL Filtering (geração anterior)" },
  AWF: { entitlements: ["AWF"], label: ADDONS.AWF },
  WF: { entitlements: ["AWF"], legacyOf: "AWF", label: "WildFire (geração anterior)" },
  DNS: { entitlements: ["DNS"], label: ADDONS.DNS },
  GP: { entitlements: ["GP"], label: ADDONS.GP },
  SDWAN: { entitlements: ["SDWAN"], label: ADDONS.SDWAN },
  "BND-CORESEC": { entitlements: ["ATP", "ADVURL", "AWF", "DNS"], label: "Core Security Subscription (ATP, URL, WildFire e DNS)" },
};

function termFrom(years?: string) {
  return years ? Number(years) * 12 : 12;
}

export const paloaltoNgfw: FamilyPack = {
  id: "paloalto-ngfw",
  vendor: "paloalto",
  vendorName: "Palo Alto Networks",
  name: "Palo Alto Networks NGFW",
  technology: "Firewall (NGFW)",
  metric: "HARDWARE_ATTACHED",
  unit: { singular: "firewall", plural: "firewalls" },
  tiers: [],
  addons: Object.entries(ADDONS).map(([id, name], i) => ({ id, name, rank: i + 1 })),
  features,
  hardware,
  skus: hardware.flatMap((h) =>
    h.skus.map<SkuRecord>((sku) => ({ ...base, sku, status: "validated", category: "HARDWARE", kind: "hardware", model: h.model, description: `Palo Alto ${h.model}: ${h.description}`, sourceIds: ["pan-eol"] })),
  ),
  parseSku: (sku) => {
    const support = /^PAN-SVC-PREM-(\d{3,4}R?)(?:-(\d)YR)?(-R)?$/.exec(sku);
    if (support) {
      const model = `PA-${support[1]}`;
      const termMonths = termFrom(support[2]);
      return { ...base, sku, category: "SUPPORT", kind: "support", model, termMonths, renewal: !!support[3], entitlements: ["PREM"], description: `Premium Support ${model}, ${termMonths / 12} ano(s)`, sourceIds: ["pan-skus-resellers"] };
    }
    const sub = /^PAN-(PA-\d{3,4}R?)-(BND-CORESEC|ATP|TP|ADVURL|URL4|AWF|WF|DNS|GP|SDWAN)(-HA2)?(?:-(\d)YR)?(-HA2)?(-R)?$/.exec(sku);
    if (sub) {
      const [, model, code, ha1, years, ha2, renewal] = sub;
      const info = SUB_CODES[code];
      const termMonths = termFrom(years);
      const haSecondary = !!(ha1 || ha2);
      return {
        ...base,
        sku,
        category: "SECURITY_SERVICE",
        kind: code === "BND-CORESEC" ? "bundle" : "addon",
        model,
        termMonths,
        haSecondary,
        renewal: !!renewal,
        entitlements: info.entitlements,
        legacy: info.legacyOf ? { replacedBy: sku.replace(`-${code}`, `-${info.legacyOf}`), note: `${info.label} foi substituída por ${ADDONS[info.legacyOf as keyof typeof ADDONS]}.` } : undefined,
        description: `${info.label}, ${model}${haSecondary ? ", segunda unidade de HA" : ""}, ${termMonths / 12} ano(s)`,
        sourceIds: ["pan-skus-resellers"],
      };
    }
    return null;
  },
  renewalSku: ({ tierId, termMonths, model, haSecondary }) => {
    if (!model || ![12, 36, 60].includes(termMonths)) return null;
    const years = termMonths > 12 ? `-${termMonths / 12}YR` : "";
    if (tierId === "PREM") return `PAN-SVC-PREM-${model.replace("PA-", "")}${years}-R`;
    if (!(tierId in ADDONS)) return null;
    return `PAN-${model}-${tierId}${haSecondary ? "-HA2" : ""}${years}-R`;
  },
  supportedTerms: [12, 36, 60],
  questions: attachedQuestions({
    features,
    haHelp: "A Palo Alto tem SKUs com sufixo HA2 para a segunda unidade de um par HA. Informe quantas unidades são secundárias.",
  }),
  rules: [
    { id: "PAN-01", name: "Assinaturas por equipamento", description: "Cada assinatura é contratada por firewall. A segunda unidade de um par HA pode usar SKU HA2.", sourceIds: ["pan-skus-resellers"] },
    { id: "PAN-02", name: "Fim de venda e fim de vida", description: "Datas e séries substitutas publicadas na página oficial de fim de vida de hardware.", sourceIds: ["pan-eol"] },
  ],
  hints: {
    ha: "Para a segunda unidade de HA existem SKUs HA2. Confirme o part number na lista de preços.",
    downgrade: "Assinatura sem uso pode sair da renovação, mas confirme dependências de política (perfis de segurança que a referenciam).",
  },
  sources,
  status: "draft",
  validatedAt: ACCESSED,
  validatedBy: "Pacote inicial VITA Lens (rascunho)",
  notes: [
    "Ciclo de vida validado na página oficial. Part numbers de assinatura seguem padrão observado em revendas e precisam de conferência.",
  ],
};
