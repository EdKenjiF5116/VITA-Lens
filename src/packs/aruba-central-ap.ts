import type { FamilyPack, HardwareModel, SkuRecord, Source } from "@/domain/types";
import { unitQuestions } from "./common";

const ACCESSED = "2026-10-21";

const sources: Source[] = [
  {
    id: "aruba-ap-features",
    title: "AP Foundation and Advanced License",
    publisher: "HPE Aruba Networking",
    url: "https://arubanetworking.hpe.com/techdocs/central/latest/content/nms/subscriptions/lic-ovr-sup-ftrs-ap.htm",
    accessedAt: ACCESSED,
    official: true,
  },
  {
    id: "aruba-skus-reseller",
    title: "Aruba Central SaaS Subscription (Q9Y58AAE a Q9Y67AAE)",
    publisher: "Secure Wireless Works (revenda)",
    url: "https://www.securewirelessworks.com/Aruba-Central-SaaS-Subscription.asp",
    accessedAt: ACCESSED,
    official: false,
  },
  {
    id: "aruba-eos",
    title: "Avisos de fim de venda (EOS Notices) HPE Aruba Networking",
    publisher: "HPE Aruba Networking",
    url: "https://www.arubanetworks.com/support-services/end-of-life/",
    official: true,
    note: "Fonte a consultar. Datas ainda não carregadas no pacote.",
  },
];

const F = ["foundation", "advanced"];
const A = ["advanced"];
const features = [
  { id: "monitoring", name: "Monitoramento, dashboards e relatórios de 90 dias", tiers: F, sourceIds: ["aruba-ap-features"] },
  { id: "ai-insights", name: "AI Insights (conectividade, qualidade, disponibilidade)", tiers: F, sourceIds: ["aruba-ap-features"] },
  { id: "airmatch-clientmatch", name: "AirMatch e ClientMatch", tiers: F, sourceIds: ["aruba-ap-features"] },
  { id: "cloud-guest-auth", name: "Cloud Guest e Cloud Auth", tiers: F, sourceIds: ["aruba-ap-features"] },
  { id: "presence-analytics", name: "Presence Analytics", tiers: F, sourceIds: ["aruba-ap-features"] },
  { id: "wips", name: "WIPS/WIDS", tiers: F, sourceIds: ["aruba-ap-features"] },
  { id: "air-slice", name: "Air Slice (priorização de aplicações)", tiers: A, sourceIds: ["aruba-ap-features"] },
  { id: "live-upgrades", name: "Live Upgrades", tiers: A, sourceIds: ["aruba-ap-features"] },
  { id: "multi-zone", name: "Multi-zone", tiers: A, sourceIds: ["aruba-ap-features"] },
  { id: "ai-advanced", name: "AI Insights avançados (buracos de cobertura, potência)", tiers: A, sourceIds: ["aruba-ap-features"] },
  { id: "streaming-api", name: "Streaming API", tiers: A, sourceIds: ["aruba-ap-features"] },
  { id: "sse-cloud-connect", name: "Integração SSE via Cloud Connect (SD-Branch)", tiers: A, needsService: true, sourceIds: ["aruba-ap-features"] },
];

const UNKNOWN = { sourceIds: ["aruba-eos"], status: "draft" as const, note: "Datas não carregadas. Consultar EOS Notice do modelo." };
const hardware: HardwareModel[] = ["AP-303", "AP-305", "AP-315", "AP-325", "AP-505", "AP-515", "AP-535", "AP-635", "AP-655"].map((model) => ({
  model,
  skus: [model],
  description: `Access point HPE Aruba ${model}`,
  lifecycle: UNKNOWN,
}));

const base = { vendor: "hpe-aruba" as const, familyId: "hpe-aruba-central-ap" };
const TERMS = [12, 36, 60, 84, 120];
const FOUNDATION = ["Q9Y58AAE", "Q9Y59AAE", "Q9Y60AAE", "Q9Y61AAE", "Q9Y62AAE"];
const ADVANCED = ["Q9Y63AAE", "Q9Y64AAE", "Q9Y65AAE", "Q9Y66AAE", "Q9Y67AAE"];

const skus: SkuRecord[] = [
  ...FOUNDATION.map<SkuRecord>((sku, i) => ({ ...base, sku, category: "SUBSCRIPTION", kind: "base", tierId: "foundation", termMonths: TERMS[i], description: `Central AP Foundation, ${TERMS[i] / 12} ano(s)`, status: "validated", sourceIds: ["aruba-skus-reseller"] })),
  ...ADVANCED.map<SkuRecord>((sku, i) => ({ ...base, sku, category: "SUBSCRIPTION", kind: "base", tierId: "advanced", termMonths: TERMS[i], description: `Central AP Advanced, ${TERMS[i] / 12} ano(s)`, status: "validated", sourceIds: ["aruba-skus-reseller"] })),
  ...hardware.map<SkuRecord>((h) => ({ ...base, sku: h.model, category: "HARDWARE", kind: "hardware", model: h.model, description: h.description, status: "draft", sourceIds: ["aruba-eos"] })),
];

export const arubaCentralAp: FamilyPack = {
  id: "hpe-aruba-central-ap",
  vendor: "hpe-aruba",
  vendorName: "HPE Aruba Networking",
  name: "HPE Aruba Networking Central (APs)",
  technology: "Wireless gerenciado em nuvem",
  metric: "PER_AP",
  unit: { singular: "access point", plural: "access points" },
  tiers: [
    { id: "foundation", name: "Foundation", rank: 1 },
    { id: "advanced", name: "Advanced", rank: 2, description: "Inclui todos os recursos do Foundation." },
  ],
  features,
  hardware,
  skus,
  renewalSku: ({ tierId, termMonths }) => {
    const i = TERMS.indexOf(termMonths);
    if (i < 0) return null;
    return tierId === "foundation" ? FOUNDATION[i] : tierId === "advanced" ? ADVANCED[i] : null;
  },
  supportedTerms: TERMS,
  questions: unitQuestions({ unitSingular: "access point", unitPlural: "access points", features }),
  rules: [
    { id: "ARUBA-01", name: "Advanced inclui Foundation", description: "O AP Advanced inclui todos os recursos do Foundation e adiciona Air Slice, Live Upgrades, Multi-zone, Streaming API e AI Insights avançados.", sourceIds: ["aruba-ap-features"] },
  ],
  sources,
  status: "draft",
  validatedAt: ACCESSED,
  validatedBy: "Pacote inicial VITA Lens (rascunho)",
  notes: [
    "Recursos por nível validados na documentação oficial. Part numbers vistos em revenda.",
    "Ciclo de vida dos APs ainda não carregado.",
  ],
};
