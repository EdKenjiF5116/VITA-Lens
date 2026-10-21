import type { FamilyPack, Finding, HardwareModel, PendingQuestion, SkuRecord, Source } from "@/domain/types";
import { unitQuestions } from "./common";

const VALIDATED = "2026-10-21";

const sources: Source[] = [
  {
    id: "meraki-mr-license-guide",
    title: "Meraki MR License Guide",
    publisher: "Cisco Meraki",
    url: "https://documentation.meraki.com/Platform_Management/Product_Information/Licensing/Meraki_MR_License_Guide",
    accessedAt: VALIDATED,
    official: true,
  },
  {
    id: "meraki-coterm",
    title: "Meraki Co-Termination Licensing Overview",
    publisher: "Cisco Meraki",
    url: "https://documentation.meraki.com/General_Administration/Licensing/Meraki_Co-Termination_Licensing_Overview",
    accessedAt: VALIDATED,
    official: true,
  },
  {
    id: "meraki-eol",
    title: "Meraki End-of-Life (EOL) Products and Dates",
    publisher: "Cisco Meraki",
    url: "https://documentation.meraki.com/General_Administration/Other_Topics/Meraki_End-of-Life_(EOL)_Products_and_Dates",
    accessedAt: VALIDATED,
    official: true,
  },
  {
    id: "cisco-networking-subscription",
    title: "Cisco Networking Subscription Data Sheet",
    publisher: "Cisco",
    url: "https://www.cisco.com/c/en/us/products/collateral/networking/software/networking-subscription-ds.html",
    accessedAt: VALIDATED,
    official: true,
  },
  {
    id: "meraki-api-inventory",
    title: "Meraki Dashboard API: Get Organization Inventory Devices",
    publisher: "Cisco DevNet",
    url: "https://developer.cisco.com/meraki/api-v1/get-organization-inventory-devices/",
    accessedAt: VALIDATED,
    official: true,
  },
];

const features = [
  { id: "standard", name: "Recursos padrão MR (SSIDs, firewall L7, traffic shaping, monitoramento)", tiers: ["ent", "adv"], sourceIds: ["meraki-mr-license-guide"] },
  { id: "live-protect", name: "Live Protect", tiers: ["ent", "adv"], sourceIds: ["meraki-mr-license-guide"] },
  { id: "spaces-essentials", name: "Cisco Spaces Essentials", tiers: ["ent", "adv"], description: "No Advanced vem o Spaces Advantage, que inclui o Essentials.", sourceIds: ["meraki-mr-license-guide"] },
  { id: "adaptive-policy", name: "Adaptive Policy (segmentação por grupo)", tiers: ["adv"], needsService: true, sourceIds: ["meraki-mr-license-guide"] },
  { id: "ai-rrm", name: "AI-RRM (gestão de rádio por IA)", tiers: ["adv"], sourceIds: ["meraki-mr-license-guide"] },
  { id: "ai-config", name: "Recomendação de configuração por IA", tiers: ["adv"], sourceIds: ["meraki-mr-license-guide"] },
  { id: "ai-pcap", name: "Analisador de captura de pacotes por IA", tiers: ["adv"], sourceIds: ["meraki-mr-license-guide"] },
  { id: "mqtt", name: "MQTT", tiers: ["adv"], description: "No licenciamento por assinatura (Cisco Networking Subscription) o MQTT também está no Essentials.", sourceIds: ["meraki-mr-license-guide"] },
  { id: "usb-port-profiles", name: "Perfis de porta e USB para IoT", tiers: ["adv"], sourceIds: ["meraki-mr-license-guide"] },
  { id: "spaces-advantage", name: "Cisco Spaces Advantage", tiers: ["adv"], needsService: true, sourceIds: ["meraki-mr-license-guide"] },
  { id: "mt-licenses", name: "2 licenças MT (sensores) por AP, só em co-term", tiers: ["adv"], sourceIds: ["meraki-mr-license-guide"] },
];

function lc(announcedAt: string, endOfSaleAt: string, endOfSupportAt: string) {
  return { announcedAt, endOfSaleAt, endOfSupportAt, sourceIds: ["meraki-eol"], status: "validated" as const };
}
const ACTIVE = { sourceIds: ["meraki-eol"], status: "validated" as const, note: "Sem anúncio de fim de venda na página de EOL consultada." };

const W7_2x2 = { model: "CW9172I", sku: "CW9172I-RTG", note: "Sugestão do pacote: Wi-Fi 7 2x2. Validar cobertura e licenciamento.", status: "draft" as const };
const W7_4x4 = { model: "CW9176I", sku: "CW9176I-RTG", note: "Sugestão do pacote: Wi-Fi 7 4x4. Validar cobertura e licenciamento.", status: "draft" as const };
const OUTDOOR = { model: "Linha outdoor atual", sku: "A-DEFINIR-OUTDOOR", note: "Sucessor outdoor a definir com o especialista.", status: "draft" as const };

const hardware: HardwareModel[] = [
  { model: "MR32", skus: ["MR32-HW"], description: "AP indoor Wi-Fi 5 wave 1", lifecycle: { announcedAt: "2017-01-18", endOfSaleAt: "2017-04-30", endOfSupportAt: "2024-07-31", sourceIds: ["meraki-eol"], status: "validated" }, successors: [W7_2x2] },
  { model: "MR33", skus: ["MR33-HW"], description: "AP indoor Wi-Fi 5 wave 2, 2x2", lifecycle: lc("2021-01-27", "2021-05-07", "2026-07-21"), successors: [W7_2x2] },
  { model: "MR42", skus: ["MR42-HW"], description: "AP indoor Wi-Fi 5 wave 2, 3x3", lifecycle: lc("2021-01-27", "2022-07-14", "2026-07-21"), successors: [W7_2x2] },
  { model: "MR42E", skus: ["MR42E-HW"], description: "AP indoor Wi-Fi 5, antenas externas", lifecycle: lc("2021-01-27", "2022-04-22", "2026-07-21"), successors: [W7_4x4] },
  { model: "MR45", skus: ["MR45-HW"], description: "AP indoor Wi-Fi 6, 4x4", lifecycle: lc("2021-01-27", "2021-07-21", "2026-07-21"), successors: [W7_4x4] },
  { model: "MR52", skus: ["MR52-HW"], description: "AP indoor Wi-Fi 5 wave 2, 4x4", lifecycle: lc("2021-01-27", "2022-04-07", "2026-07-21"), successors: [W7_4x4] },
  { model: "MR53", skus: ["MR53-HW"], description: "AP indoor Wi-Fi 5 wave 2, 4x4", lifecycle: lc("2021-01-27", "2021-05-07", "2026-07-21"), successors: [W7_4x4] },
  { model: "MR53E", skus: ["MR53E-HW"], description: "AP indoor Wi-Fi 5, antenas externas", lifecycle: lc("2021-01-27", "2022-04-07", "2026-07-21"), successors: [W7_4x4] },
  { model: "MR74", skus: ["MR74-HW"], description: "AP outdoor Wi-Fi 5", lifecycle: lc("2021-01-27", "2021-07-21", "2026-07-21"), successors: [OUTDOOR] },
  { model: "MR84", skus: ["MR84-HW"], description: "AP outdoor Wi-Fi 5", lifecycle: lc("2021-01-27", "2021-05-07", "2026-07-21"), successors: [OUTDOOR] },
  { model: "MR20", skus: ["MR20-HW"], description: "AP indoor Wi-Fi 5, 2x2", lifecycle: lc("2022-12-19", "2023-06-01", "2028-06-13"), successors: [W7_2x2] },
  { model: "MR30H", skus: ["MR30H-HW"], description: "AP de parede (hospitality)", lifecycle: lc("2022-03-25", "2022-05-31", "2027-07-26"), successors: [W7_2x2] },
  { model: "MR55", skus: ["MR55-HW"], description: "AP indoor Wi-Fi 6, 8x8", lifecycle: lc("2022-02-15", "2022-04-07", "2027-08-01"), successors: [W7_4x4] },
  { model: "MR70", skus: ["MR70-HW"], description: "AP outdoor Wi-Fi 5", lifecycle: lc("2023-08-18", "2024-02-19", "2029-02-19"), successors: [OUTDOOR] },
  { model: "MR56", skus: ["MR56-HW"], description: "AP indoor Wi-Fi 6, 8x8", lifecycle: lc("2025-02-07", "2025-08-07", "2030-08-07"), successors: [W7_4x4] },
  { model: "MR36", skus: ["MR36-HW"], description: "AP indoor Wi-Fi 6, 2x2", lifecycle: lc("2026-03-30", "2026-12-31", "2031-12-31"), successors: [W7_2x2] },
  { model: "MR36H", skus: ["MR36H-HW"], description: "AP de parede Wi-Fi 6", lifecycle: lc("2026-03-30", "2026-12-31", "2031-12-31"), successors: [W7_2x2] },
  { model: "MR44", skus: ["MR44-HW"], description: "AP indoor Wi-Fi 6, 4x4 (5 GHz)", lifecycle: lc("2026-03-30", "2026-12-31", "2031-12-31"), successors: [W7_2x2] },
  { model: "MR46", skus: ["MR46-HW"], description: "AP indoor Wi-Fi 6, 4x4", lifecycle: lc("2026-03-30", "2026-12-31", "2031-12-31"), successors: [W7_4x4] },
  { model: "MR46E", skus: ["MR46E-HW"], description: "AP indoor Wi-Fi 6, antenas externas", lifecycle: lc("2026-03-30", "2026-12-31", "2031-12-31"), successors: [W7_4x4] },
  { model: "MR28", skus: ["MR28-HW"], description: "AP indoor Wi-Fi 6, 2x2", lifecycle: ACTIVE },
  { model: "MR57", skus: ["MR57-HW"], description: "AP indoor Wi-Fi 6E, 4x4", lifecycle: ACTIVE },
  { model: "MR78", skus: ["MR78-HW"], description: "AP outdoor Wi-Fi 6", lifecycle: ACTIVE },
  { model: "MR86", skus: ["MR86-HW"], description: "AP outdoor Wi-Fi 6", lifecycle: ACTIVE },
  { model: "CW9166I", skus: ["CW9166I-MR"], description: "AP indoor Wi-Fi 6E, gerenciado pelo Meraki", lifecycle: ACTIVE },
  { model: "CW9172I", skus: ["CW9172I-RTG"], description: "AP indoor Wi-Fi 7, 2x2", lifecycle: { ...ACTIVE, sourceIds: ["meraki-eol", "cisco-networking-subscription"] } },
  { model: "CW9176I", skus: ["CW9176I-RTG"], description: "AP indoor Wi-Fi 7, 4x4", lifecycle: { ...ACTIVE, sourceIds: ["meraki-eol", "cisco-networking-subscription"] } },
];

const base = { vendor: "cisco" as const, familyId: "cisco-meraki-mr", status: "validated" as const };

function lic(sku: string, tierId: "ent" | "adv", kind: "base" | "upgrade", termMonths: number | undefined, description: string): SkuRecord {
  const rec: SkuRecord = {
    ...base,
    sku,
    category: "LICENSE",
    kind,
    tierId,
    termMonths,
    description,
    sourceIds: ["meraki-mr-license-guide"],
  };
  if (kind === "upgrade") {
    rec.dependencies = [
      {
        type: "MANDATORY",
        requires: "MR Enterprise na mesma quantidade",
        satisfiedBy: { skuPrefix: "LIC-ENT-" },
        note: "MR Upgrade não licencia um AP sozinho. MR Enterprise + MR Upgrade = MR Advanced.",
        sourceIds: ["meraki-mr-license-guide"],
      },
    ];
  }
  return rec;
}

const termName = (m: number) => (m < 12 ? "1 dia" : `${m / 12} ${m === 12 ? "ano" : "anos"}`);

const skus: SkuRecord[] = [
  ...[12, 36, 60, 84, 120].map((m) => lic(`LIC-ENT-${m / 12}YR`, "ent", "base", m, `Licença MR Enterprise por AP, ${termName(m)}`)),
  lic("LIC-MR-UPGR-1D", "adv", "upgrade", 0, "MR Upgrade, 1 dia (ajuste de licença)"),
  ...[12, 36, 60].map((m) => lic(`LIC-MR-UPGR-${m / 12}Y`, "adv", "upgrade", m, `MR Upgrade (Enterprise para Advanced), ${termName(m)}`)),
  lic("LIC-MR-ADV-1D", "adv", "base", 0, "MR Advanced, 1 dia (ajuste de licença)"),
  ...[12, 36, 60].map((m) => lic(`LIC-MR-ADV-${m / 12}Y`, "adv", "base", m, `Licença MR Advanced por AP, ${termName(m)}`)),
  { ...base, sku: "LIC-MR-E", category: "SUBSCRIPTION", kind: "base", tierId: "ent", description: "Meraki MR Essentials por assinatura (Cisco Networking Subscription)", sourceIds: ["cisco-networking-subscription"] },
  { ...base, sku: "LIC-MR-A", category: "SUBSCRIPTION", kind: "base", tierId: "adv", description: "Meraki MR Advantage por assinatura (Cisco Networking Subscription)", sourceIds: ["cisco-networking-subscription"] },
  { ...base, sku: "LIC-CW-E", category: "SUBSCRIPTION", kind: "base", tierId: "ent", description: "Cisco Wireless Essentials por assinatura", sourceIds: ["cisco-networking-subscription"] },
  { ...base, sku: "LIC-CW-A", category: "SUBSCRIPTION", kind: "base", tierId: "adv", description: "Cisco Wireless Advantage por assinatura", sourceIds: ["cisco-networking-subscription"] },
  ...hardware.flatMap((h) =>
    h.skus.map<SkuRecord>((sku) => ({
      ...base,
      sku,
      category: "HARDWARE",
      kind: "hardware",
      model: h.model,
      description: `Access point Meraki ${h.model}: ${h.description}`,
      sourceIds: h.lifecycle?.sourceIds ?? ["meraki-eol"],
    })),
  ),
];

const RENEWAL: Record<string, Record<number, string>> = {
  ent: { 12: "LIC-ENT-1YR", 36: "LIC-ENT-3YR", 60: "LIC-ENT-5YR", 84: "LIC-ENT-7YR", 120: "LIC-ENT-10YR" },
  adv: { 12: "LIC-MR-ADV-1Y", 36: "LIC-MR-ADV-3Y", 60: "LIC-MR-ADV-5Y" },
};

export const ciscoMerakiMr: FamilyPack = {
  id: "cisco-meraki-mr",
  vendor: "cisco",
  vendorName: "Cisco",
  name: "Cisco Meraki MR",
  technology: "Wireless gerenciado em nuvem",
  metric: "PER_AP",
  unit: { singular: "access point", plural: "access points" },
  coterm: true,
  tiers: [
    { id: "ent", name: "Enterprise / Essentials", rank: 1, description: "MR Enterprise (co-term) ou MR Essentials (assinatura)." },
    { id: "adv", name: "Advanced / Advantage", rank: 2, description: "MR Advanced (co-term) ou MR Advantage (assinatura). Inclui tudo do nível anterior." },
  ],
  features,
  hardware,
  skus,
  renewalSku: ({ tierId, termMonths }) => RENEWAL[tierId]?.[termMonths] ?? null,
  supportedTerms: [12, 36, 60],
  questions: unitQuestions({
    unitSingular: "access point",
    unitPlural: "access points",
    features,
    sparesHelp:
      "No co-term só contam os APs adicionados a uma rede no Dashboard. AP guardado só no inventário da organização não consome licença.",
  }),
  rules: [
    { id: "MR-01", name: "Uma edição por organização co-term", description: "Uma organização co-term tem uma única edição de MR (Enterprise ou Advanced). Misturar edições não é suportado.", sourceIds: ["meraki-mr-license-guide"] },
    { id: "MR-02", name: "Upgrade igual ao limite Enterprise", description: "Para converter a edição para Advanced, a quantidade de MR Upgrade precisa ser igual ao limite de licenças MR Enterprise.", sourceIds: ["meraki-mr-license-guide"] },
    { id: "MR-03", name: "Só APs em rede contam", description: "No co-term, a contagem de equipamentos considera só os adicionados a alguma rede. Equipamentos apenas no inventário não contam.", sourceIds: ["meraki-coterm"] },
    { id: "MR-04", name: "Excesso de equipamentos ou vencimento", description: "Contagem acima do limite ou licença vencida abre 30 dias de carência. Depois disso a organização é desligada até regularizar.", sourceIds: ["meraki-coterm"] },
  ],
  hints: {
    downgrade:
      "No co-term, a redução de Advanced para Enterprise deve ser feita perto da data de co-term, pela opção de renovar o licenciamento do Dashboard.",
    upgrade: "Para converter a organização, compre MR Upgrade na mesma quantidade do limite Enterprise, usando a opção de licenciar mais dispositivos.",
    spares: "No co-term, APs que ficam só no inventário, fora de redes, não consomem licença.",
    refresh:
      "Os APs Wi-Fi 7 sugeridos podem usar o licenciamento por assinatura (Cisco Networking Subscription). Validar o modelo de licenciamento da organização antes da cotação.",
  },
  extraRules: (ctx) => {
    const findings: Finding[] = [];
    const pending: PendingQuestion[] = [];
    const baseItems = ctx.licenseItems.filter((i) => i.record?.kind === "base");
    const upgr = ctx.licenseItems.filter((i) => i.record?.kind === "upgrade");
    const tiersFound = new Set(baseItems.map((i) => i.record?.tierId));
    if (tiersFound.has("ent") && tiersFound.has("adv")) {
      findings.push({
        key: "cisco-meraki-mr:MR-01",
        familyId: "cisco-meraki-mr",
        dimension: "coverage",
        verdict: "INCONSISTENT",
        severity: "attention",
        title: "Licenças Enterprise e Advanced na mesma lista",
        explanation:
          "Uma organização co-term tem uma única edição de MR. A lista traz licenças das duas edições, o que indica organizações diferentes ou um pedido que não pode ser aplicado como está.",
        recommendation: { type: "MANUAL_REVIEW", text: "Confirmar quantas organizações Meraki existem e qual edição cada uma usa." },
        affected: baseItems.map((i) => i.effectiveSku),
        rule: { id: "MR-01", name: "Uma edição por organização co-term" },
        evidence: [{ label: "Edições encontradas", value: "Enterprise e Advanced", origin: "documented" }],
        sourceIds: ["meraki-mr-license-guide"],
        confidence: "high",
      });
    }
    if (upgr.length > 0) {
      const entQty = baseItems.filter((i) => i.record?.tierId === "ent").reduce((s, i) => s + i.quantity, 0);
      const upQty = upgr.reduce((s, i) => s + i.quantity, 0);
      if (entQty > 0 && entQty !== upQty) {
        findings.push({
          key: "cisco-meraki-mr:MR-02",
          familyId: "cisco-meraki-mr",
          dimension: "dependency",
          verdict: "MANDATORY_DEPENDENCY",
          severity: "critical",
          title: `MR Upgrade (${upQty}) diferente do limite Enterprise (${entQty})`,
          explanation:
            "Para converter a organização para Advanced, a quantidade de MR Upgrade precisa ser exatamente igual ao limite de licenças MR Enterprise.",
          recommendation: { type: "ADJUST_QUANTITY", text: `Ajustar MR Upgrade para ${entQty} ou rever o limite Enterprise.` },
          affected: [...upgr, ...baseItems].map((i) => i.effectiveSku),
          rule: { id: "MR-02", name: "Upgrade igual ao limite Enterprise" },
          evidence: [
            { label: "MR Enterprise na lista", value: String(entQty), origin: "documented" },
            { label: "MR Upgrade na lista", value: String(upQty), origin: "documented" },
          ],
          sourceIds: ["meraki-mr-license-guide"],
          confidence: "high",
        });
      }
    }
    return { findings, pending };
  },
  sources,
  status: "validated",
  validatedAt: VALIDATED,
  validatedBy: "Pacote inicial VITA Lens",
  notes: [
    "Licenciamento co-term e por assinatura no mesmo pacote. Licenças por dispositivo (PDL) não aceitam novas conversões.",
    "Sucessores Wi-Fi 7 são sugestões do pacote e precisam de validação técnica.",
  ],
};
