import type { FamilyPack, HardwareModel, SkuRecord, Source } from "@/domain/types";
import { attachedQuestions } from "./common";

const ACCESSED = "2026-10-21";

const sources: Source[] = [
  {
    id: "fortinet-skus-resellers",
    title: "Listagens de revendas com part numbers FortiGate (FC-10-...-928/950/809/204)",
    publisher: "Revendas (datacenter360.ca, tnp.net.uk)",
    url: "https://datacenter360.ca/shop/network-security/firewall/licensing/fortigate-401e-1-year-advanced-threat-protection-ips-advanced-malware-protection-service-application-control-and-forticare-premium-fc-10-0401e-928-02-12/",
    accessedAt: ACCESSED,
    official: false,
    note: "Estrutura do part number confirmada em várias listagens. Validar com a lista de preços do distribuidor.",
  },
  {
    id: "fortinet-utp-reseller",
    title: "FortiGate 60F 24x7 UTP Bundle (FC-10-0060F-950-02-12)",
    publisher: "TNP Store",
    url: "https://store.tnp.net.uk/forticare/fortinet-fortigate-60f-24x7-utp-bundle.html",
    accessedAt: ACCESSED,
    official: false,
  },
  {
    id: "fortinet-datasheet",
    title: "FortiGate datasheets, tabela de bundles",
    publisher: "Fortinet",
    url: "https://www.fortinet.com/products/next-generation-firewall",
    official: true,
    note: "Fonte a conferir: o conteúdo dos bundles muda entre versões do FortiOS.",
  },
  {
    id: "fortinet-lifecycle",
    title: "Fortinet Product Life Cycle",
    publisher: "Fortinet Support",
    url: "https://support.fortinet.com/Information/ProductLifeCycle.aspx",
    official: true,
    note: "Requer login no portal de suporte. Datas ainda não carregadas no pacote.",
  },
];

/** Código do modelo dentro do part number FC-10-XXXXX. Só códigos vistos em listagens. */
const MODEL_CODE: Record<string, string> = {
  "FG-40F": "0040F",
  "FG-60E": "0060E",
  "FG-60F": "0060F",
  "FG-70F": "0070F",
  "FG-80F": "0080F",
  "FG-90G": "0090G",
  "FG-100F": "F100F",
  "FG-401E": "0401E",
  "FG-600F": "0600F",
};
const CODE_MODEL = Object.fromEntries(Object.entries(MODEL_CODE).map(([m, c]) => [c, m]));

const BUNDLE: Record<string, { tierId: string; name: string; kind: "bundle" | "support" | "addon"; category: SkuRecord["category"] }> = {
  "247": { tierId: "fcp", name: "FortiCare Premium (suporte 24x7)", kind: "support", category: "SUPPORT" },
  "928": { tierId: "atp", name: "Advanced Threat Protection (ATP) com FortiCare Premium", kind: "bundle", category: "SECURITY_SERVICE" },
  "950": { tierId: "utp", name: "Unified Threat Protection (UTP) com FortiCare Premium", kind: "bundle", category: "SECURITY_SERVICE" },
  "809": { tierId: "ent", name: "Enterprise Protection com FortiCare Premium", kind: "bundle", category: "SECURITY_SERVICE" },
};
const TIER_CODE: Record<string, string> = { fcp: "247", atp: "928", utp: "950", ent: "809" };

const features = [
  { id: "app-control", name: "Controle de aplicações", tiers: ["fcp", "atp", "utp", "ent"], description: "Assinaturas de aplicação acompanham o FortiCare. Validar na versão do FortiOS.", sourceIds: ["fortinet-datasheet"] },
  { id: "ips", name: "IPS", tiers: ["atp", "utp", "ent"], sourceIds: ["fortinet-skus-resellers", "fortinet-datasheet"] },
  { id: "amp", name: "Advanced Malware Protection (antivírus, botnet, sandbox em nuvem)", tiers: ["atp", "utp", "ent"], sourceIds: ["fortinet-skus-resellers", "fortinet-datasheet"] },
  { id: "web-filtering", name: "Filtro web (URL)", tiers: ["utp", "ent"], sourceIds: ["fortinet-utp-reseller", "fortinet-datasheet"] },
  { id: "dns-filtering", name: "Filtro DNS", tiers: ["utp", "ent"], sourceIds: ["fortinet-datasheet"] },
  { id: "video-filtering", name: "Filtro de vídeo", tiers: ["utp", "ent"], sourceIds: ["fortinet-datasheet"] },
  { id: "antispam", name: "Antispam", tiers: ["utp", "ent"], sourceIds: ["fortinet-utp-reseller", "fortinet-datasheet"] },
  { id: "attack-surface", name: "Attack Surface Security (detecção de IoT e Security Rating)", tiers: ["ent"], needsService: true, sourceIds: ["fortinet-datasheet"] },
];

const LIFECYCLE_UNKNOWN = {
  sourceIds: ["fortinet-lifecycle"],
  status: "draft" as const,
  note: "Datas não carregadas. Consultar o Product Life Cycle no portal Fortinet.",
};

const hardware: HardwareModel[] = Object.keys(MODEL_CODE).map((model) => ({
  model,
  skus: [model],
  description: `FortiGate ${model.replace("FG-", "")}`,
  lifecycle: LIFECYCLE_UNKNOWN,
}));

const base = { vendor: "fortinet" as const, familyId: "fortinet-fortigate", status: "draft" as const };

export const fortinetFortigate: FamilyPack = {
  id: "fortinet-fortigate",
  vendor: "fortinet",
  vendorName: "Fortinet",
  name: "Fortinet FortiGate",
  technology: "Firewall (NGFW)",
  metric: "HARDWARE_ATTACHED",
  unit: { singular: "firewall", plural: "firewalls" },
  tiers: [
    { id: "fcp", name: "Só FortiCare Premium", rank: 1 },
    { id: "atp", name: "ATP", rank: 2 },
    { id: "utp", name: "UTP", rank: 3 },
    { id: "ent", name: "Enterprise Protection", rank: 4 },
  ],
  features,
  hardware,
  skus: hardware.map((h) => ({
    ...base,
    sku: h.model,
    category: "HARDWARE",
    kind: "hardware",
    model: h.model,
    description: h.description,
    sourceIds: ["fortinet-skus-resellers"],
  })),
  parseSku: (sku) => {
    const sub = /^FC-10-([0-9A-Z]{5})-(\d{3})-02-(\d{2})$/.exec(sku);
    if (sub) {
      const [, code, bundleCode, term] = sub;
      const model = CODE_MODEL[code];
      const termMonths = Number(term);
      if (bundleCode === "204") {
        return { ...base, sku, category: "SUPPORT", kind: "addon", model, termMonths, serviceKey: "elite", description: `Upgrade de FortiCare Premium para Elite${model ? ` (${model})` : ""}`, sourceIds: ["fortinet-skus-resellers"] };
      }
      const b = BUNDLE[bundleCode];
      if (!b) return null;
      return {
        ...base,
        sku,
        category: b.category,
        kind: b.kind,
        tierId: b.tierId,
        serviceKey: "protection",
        model,
        termMonths,
        description: `${b.name}, ${model ?? `modelo ${code} não cadastrado`}, ${termMonths / 12} ${termMonths === 12 ? "ano" : "anos"}`,
        sourceIds: ["fortinet-skus-resellers"],
      };
    }
    const hw = /^(FG|FWF)-(\d{2,4}[A-Z])(-BDL-(\d{3})-(\d{2}))?$/.exec(sku);
    if (hw) {
      const model = `${hw[1]}-${hw[2]}`;
      const bundle = hw[4] ? BUNDLE[hw[4]] : undefined;
      return {
        ...base,
        sku,
        category: "HARDWARE",
        kind: "hardware",
        model,
        description: bundle ? `${model} com ${bundle.name} (${Number(hw[5]) / 12} ano(s) inicial)` : `${hw[1] === "FWF" ? "FortiWiFi" : "FortiGate"} ${hw[2]}`,
        sourceIds: ["fortinet-skus-resellers"],
      };
    }
    return null;
  },
  renewalSku: ({ tierId, termMonths, model }) => {
    const code = model ? MODEL_CODE[model] : undefined;
    const bundle = TIER_CODE[tierId];
    if (!code || !bundle || ![12, 36, 60].includes(termMonths)) return null;
    return `FC-10-${code}-${bundle}-02-${termMonths}`;
  },
  supportedTerms: [12, 36, 60],
  questions: attachedQuestions({
    features,
    haHelp: "Na Fortinet cada unidade do cluster HA precisa da própria assinatura. Informe para conferência.",
  }),
  rules: [
    { id: "FTNT-01", name: "Um bundle por unidade", description: "Cada FortiGate, inclusive a segunda unidade de um HA, precisa de suporte e serviços próprios.", sourceIds: ["fortinet-datasheet"] },
    { id: "FTNT-02", name: "Part number codifica modelo, bundle e prazo", description: "FC-10-[modelo]-[bundle]-02-[meses]. 928 = ATP, 950 = UTP, 809 = Enterprise Protection, 247 = FortiCare Premium.", sourceIds: ["fortinet-skus-resellers"] },
  ],
  hints: {
    ha: "Na Fortinet não há desconto de HA por SKU: cada unidade do cluster leva o próprio bundle.",
    lifecycle: "Consultar o Product Life Cycle no portal Fortinet e informar as datas em Datas de ciclo de vida por modelo, na etapa de utilização.",
  },
  sources,
  status: "draft",
  validatedAt: ACCESSED,
  validatedBy: "Pacote inicial VITA Lens (rascunho)",
  notes: [
    "Pacote em rascunho: estrutura de SKU vista em revendas, conteúdo dos bundles ainda não conferido no datasheet oficial.",
    "Sem datas de ciclo de vida: o motor marca como não confirmado e pede as datas.",
  ],
};
