import type { FamilyPack, HardwareModel, Source } from "@/domain/types";
import { unitQuestions } from "./common";

const ACCESSED = "2026-10-21";

const sources: Source[] = [
  {
    id: "huawei-n1",
    title: "Modelo de negócio N1 (CloudCampus)",
    publisher: "Huawei",
    url: "https://info.support.huawei.com/info-finder/encyclopedia/en/CloudFabric+N1+Business+Model.html",
    accessedAt: ACCESSED,
    official: true,
    note: "Página descreve o modelo N1. Níveis e recursos para APs ainda precisam de conferência com a Huawei.",
  },
  {
    id: "huawei-lifecycle",
    title: "Huawei Enterprise: avisos de fim de comercialização e serviço (EOM/EOS)",
    publisher: "Huawei",
    url: "https://support.huawei.com/enterprise/en/bulletins-product",
    official: true,
    note: "Fonte a consultar. Datas ainda não carregadas.",
  },
];

const features = [
  { id: "cloud-mgmt", name: "Gerenciamento e monitoramento em nuvem", tiers: ["foundation", "advanced"], sourceIds: ["huawei-n1"] },
  { id: "advanced-ops", name: "Recursos avançados de operação e análise (a validar)", tiers: ["advanced"], sourceIds: ["huawei-n1"] },
];

const UNKNOWN = { sourceIds: ["huawei-lifecycle"], status: "draft" as const, note: "Datas não carregadas. Consultar boletim EOM/EOS do modelo." };
const hardware: HardwareModel[] = ["AP4050DN", "AP5050DN", "AP6050DN", "AIRENGINE 5761-11", "AIRENGINE 5762-12", "AIRENGINE 6761-21"].map((model) => ({
  model,
  skus: [model],
  description: `Access point Huawei ${model}`,
  lifecycle: UNKNOWN,
}));

const base = { vendor: "huawei" as const, familyId: "huawei-wlan", status: "draft" as const };

export const huaweiWlan: FamilyPack = {
  id: "huawei-wlan",
  vendor: "huawei",
  vendorName: "Huawei",
  name: "Huawei WLAN (CloudCampus)",
  technology: "Wireless",
  metric: "PER_AP",
  unit: { singular: "access point", plural: "access points" },
  tiers: [
    { id: "foundation", name: "N1 Foundation", rank: 1 },
    { id: "advanced", name: "N1 Advanced", rank: 2 },
  ],
  features,
  hardware,
  skus: hardware.map((h) => ({ ...base, sku: h.model, category: "HARDWARE", kind: "hardware", model: h.model, description: h.description, sourceIds: ["huawei-lifecycle"] })),
  parseSku: (sku) => {
    const ap = /^(AIRENGINE ?\d{4}-\d{2}[A-Z]*|AP\d{4}[A-Z]{2,3}(-[A-Z0-9]+)?)$/.exec(sku);
    if (ap) {
      const model = sku.replace(/^AIRENGINE ?/, "AIRENGINE ");
      return { ...base, sku, category: "HARDWARE", kind: "hardware", model, description: `Access point Huawei ${model}`, sourceIds: ["huawei-lifecycle"] };
    }
    if (/^N1-/.test(sku)) {
      const tierId = /ADV/.test(sku) ? "advanced" : /FOUND|FND|BASIC/.test(sku) ? "foundation" : undefined;
      return { ...base, sku, category: "SUBSCRIPTION", kind: "base", tierId, description: `Licença N1 CloudCampus${tierId ? ` (${tierId === "advanced" ? "Advanced" : "Foundation"})` : ""}`, sourceIds: ["huawei-n1"] };
    }
    return null;
  },
  renewalSku: () => null,
  supportedTerms: [12, 36, 60],
  questions: unitQuestions({ unitSingular: "access point", unitPlural: "access points", features }),
  rules: [],
  sources,
  status: "draft",
  validatedAt: ACCESSED,
  validatedBy: "Pacote inicial VITA Lens (rascunho)",
  notes: [
    "Pacote em rascunho para demonstrar o comportamento com catálogo incompleto: itens são reconhecidos, mas conclusões saem com confiança baixa e SKUs de renovação ficam a definir.",
  ],
};
