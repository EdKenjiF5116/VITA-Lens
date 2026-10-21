import type { FamilyPack, Finding, ListPrice, SkuRecord, Source } from "@/domain/types";
import { userQuestions } from "./common";

const VALIDATED = "2026-10-21";

const sources: Source[] = [
  {
    id: "duo-ordering-guide",
    title: "Duo Ordering Guide",
    publisher: "Cisco",
    url: "https://www.cisco.com/c/en/us/products/collateral/security/guide-c07-742970.html",
    accessedAt: VALIDATED,
    official: true,
  },
  {
    id: "duo-editions",
    title: "Duo Editions and Pricing",
    publisher: "Cisco Duo",
    url: "https://duo.com/editions-and-pricing",
    accessedAt: VALIDATED,
    official: true,
  },
];

const features = [
  { id: "mfa", name: "MFA resistente a phishing e Verified Duo Push", tiers: ["ess", "adv", "prem"], sourceIds: ["duo-ordering-guide"] },
  { id: "sso", name: "Single sign-on (Duo SSO)", tiers: ["ess", "adv", "prem"], sourceIds: ["duo-ordering-guide"] },
  { id: "passwordless", name: "Passwordless", tiers: ["ess", "adv", "prem"], sourceIds: ["duo-ordering-guide"] },
  { id: "trusted-endpoints", name: "Trusted Endpoints", tiers: ["ess", "adv", "prem"], sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "duo-directory", name: "Duo Directory", tiers: ["ess", "adv", "prem"], sourceIds: ["duo-ordering-guide"] },
  { id: "device-health", name: "Device Health (postura do dispositivo)", tiers: ["adv", "prem"], sourceIds: ["duo-ordering-guide"] },
  { id: "risk-based-auth", name: "Autenticação baseada em risco", tiers: ["adv", "prem"], sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "adaptive-policies", name: "Políticas de acesso por aplicação", tiers: ["adv", "prem"], sourceIds: ["duo-ordering-guide"] },
  { id: "identity-intelligence", name: "Cisco Identity Intelligence (ITDR e ISPM)", tiers: ["adv", "prem"], needsService: true, sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "passport", name: "Duo Passport", tiers: ["adv", "prem"], sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "session-theft", name: "Proteção contra roubo de sessão", tiers: ["adv", "prem"], sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "ad-defense", name: "Active Directory Defense", tiers: ["adv", "prem"], sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "vpnless", name: "Acesso a apps privados sem VPN (Duo Network Gateway)", tiers: ["prem"], needsService: true, sourceIds: ["duo-ordering-guide", "duo-editions"] },
  { id: "agent-verification", name: "Verificação de agente de segurança no endpoint", tiers: ["prem"], sourceIds: ["duo-ordering-guide"] },
];

function price(monthly: number): ListPrice {
  return { amount: monthly, currency: "USD", per: "unit-month", sourceId: "duo-ordering-guide" };
}

/** Preço de lista mensal por usuário, por faixa de quantidade (Duo Ordering Guide). */
export const DUO_PRICE_BANDS: Record<string, { minQty: number; amount: number }[]> = {
  "DUO-ESSENTIALS": [
    { minQty: 1, amount: 3.0 },
    { minQty: 1000, amount: 2.84 },
    { minQty: 10000, amount: 2.5 },
  ],
  "DUO-ADVANTAGE": [
    { minQty: 1, amount: 6.0 },
    { minQty: 1000, amount: 5.67 },
    { minQty: 10000, amount: 5.0 },
  ],
  "DUO-PREMIER": [
    { minQty: 1, amount: 9.0 },
    { minQty: 1000, amount: 8.5 },
    { minQty: 10000, amount: 7.5 },
  ],
};

const base = { vendor: "cisco" as const, familyId: "cisco-duo", status: "validated" as const };
const needsWrapper = [
  {
    type: "MANDATORY" as const,
    requires: "Assinatura DUO-SUB",
    satisfiedBy: { skuPrefix: "DUO-SUB" },
    note: "Cada cliente final tem uma assinatura DUO-SUB, com uma linha por pedido. A edição é um item dessa assinatura.",
    forQuote: true,
    sourceIds: ["duo-ordering-guide"],
  },
];

const skus: SkuRecord[] = [
  { ...base, sku: "DUO-ESSENTIALS", category: "SUBSCRIPTION", kind: "base", tierId: "ess", description: "Duo Essentials por usuário", listPrice: price(3), dependencies: needsWrapper, sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "DUO-ADVANTAGE", category: "SUBSCRIPTION", kind: "base", tierId: "adv", description: "Duo Advantage por usuário", listPrice: price(6), dependencies: needsWrapper, sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "DUO-PREMIER", category: "SUBSCRIPTION", kind: "base", tierId: "prem", description: "Duo Premier por usuário", listPrice: price(9), dependencies: needsWrapper, sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "DUO-SUB", category: "SUBSCRIPTION", kind: "wrapper", description: "Assinatura Duo (uma por cliente final)", sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "DUO-TLPHNY-1K", category: "CLOUD_SERVICE", kind: "addon", description: "1.000 créditos de telefonia (SMS e ligação)", listPrice: { amount: 15, currency: "USD", per: "unit", sourceId: "duo-ordering-guide" }, sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "DUO-SUBACCT", category: "CLOUD_SERVICE", kind: "addon", description: "Subconta Duo", listPrice: { amount: 0, currency: "USD", per: "unit", sourceId: "duo-ordering-guide" }, sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "DUO-TOKEN-10PACK", category: "ACCESSORY", kind: "addon", description: "Pacote com 10 tokens físicos", listPrice: { amount: 300, currency: "USD", per: "unit", sourceId: "duo-ordering-guide" }, sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "SVS-DUO-SUP-B", category: "SUPPORT", kind: "support", description: "Duo Support Basic", sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "SVS-DUO-SUP-S", category: "SUPPORT", kind: "support", description: "Duo Support Solution", sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "SVS-DUO-SUP-E", category: "SUPPORT", kind: "support", description: "Duo Support Standard", sourceIds: ["duo-ordering-guide"] },
  { ...base, sku: "SVS-DUO-SUP-P", category: "SUPPORT", kind: "support", description: "Duo Support Signature (mínimo anual de US$ 14.000)", sourceIds: ["duo-ordering-guide"] },
  {
    ...base,
    sku: "DUO-MFA",
    category: "SUBSCRIPTION",
    kind: "base",
    tierId: "ess",
    description: "Duo MFA (edição antiga)",
    legacy: { replacedBy: "DUO-ESSENTIALS", note: "Edição antiga. Mapeamento usual: MFA para Essentials. Confirmar recursos usados." },
    status: "draft",
    sourceIds: ["duo-editions"],
  },
  {
    ...base,
    sku: "DUO-ACCESS",
    category: "SUBSCRIPTION",
    kind: "base",
    tierId: "adv",
    description: "Duo Access (edição antiga)",
    legacy: { replacedBy: "DUO-ADVANTAGE", note: "Edição antiga. Mapeamento usual: Access para Advantage. Confirmar recursos usados." },
    status: "draft",
    sourceIds: ["duo-editions"],
  },
  {
    ...base,
    sku: "DUO-BEYOND",
    category: "SUBSCRIPTION",
    kind: "base",
    tierId: "prem",
    description: "Duo Beyond (edição antiga)",
    legacy: { replacedBy: "DUO-PREMIER", note: "Edição antiga. Mapeamento usual: Beyond para Premier. Confirmar recursos usados." },
    status: "draft",
    sourceIds: ["duo-editions"],
  },
];

const EDITION: Record<string, string> = { ess: "DUO-ESSENTIALS", adv: "DUO-ADVANTAGE", prem: "DUO-PREMIER" };

export const ciscoDuo: FamilyPack = {
  id: "cisco-duo",
  vendor: "cisco",
  vendorName: "Cisco",
  name: "Cisco Duo",
  technology: "Identidade e MFA",
  metric: "PER_USER",
  unit: { singular: "usuário", plural: "usuários" },
  tiers: [
    { id: "ess", name: "Essentials", rank: 1 },
    { id: "adv", name: "Advantage", rank: 2 },
    { id: "prem", name: "Premier", rank: 3 },
  ],
  features,
  hardware: [],
  skus,
  renewalSku: ({ tierId }) => EDITION[tierId] ?? null,
  supportedTerms: [12, 24, 36, 48, 60],
  questions: userQuestions(
    features,
    "Use o total do relatório de usuários do painel administrativo do Duo. Confira no painel quais status de usuário contam na licença.",
  ),
  rules: [
    { id: "DUO-01", name: "Uma edição por assinatura", description: "O cliente compra uma única edição (PID de produto) por assinatura.", sourceIds: ["duo-ordering-guide"] },
    { id: "DUO-02", name: "Prazo de 12 a 60 meses", description: "Prazos de 1 a 11 meses exigem aprovação e só podem co-terminar com contrato maior que 12 meses.", sourceIds: ["duo-ordering-guide"] },
    { id: "DUO-03", name: "Sem cancelamento com crédito", description: "Cancelamentos no meio do prazo não geram crédito. Ajustes de quantidade precisam acontecer na renovação.", sourceIds: ["duo-ordering-guide"] },
  ],
  hints: {
    downgrade: "Como não há crédito por cancelamento no meio do prazo, a troca de edição precisa ser decidida antes da renovação.",
  },
  extraRules: (ctx) => {
    const findings: Finding[] = [];
    const editions = new Set(ctx.licenseItems.filter((i) => i.record?.kind === "base").map((i) => i.record?.tierId));
    if (editions.size > 1) {
      findings.push({
        key: "cisco-duo:DUO-01",
        familyId: "cisco-duo",
        dimension: "coverage",
        verdict: "INCONSISTENT",
        severity: "attention",
        title: "Mais de uma edição Duo na lista",
        explanation: "Cada assinatura comporta uma única edição. Mais de uma edição indica contas diferentes ou um pedido que precisa ser unificado.",
        recommendation: { type: "CONSOLIDATE_CONTRACTS", text: "Definir uma edição para a renovação ou separar as contas Duo." },
        affected: ctx.licenseItems.map((i) => i.effectiveSku),
        rule: { id: "DUO-01", name: "Uma edição por assinatura" },
        evidence: [{ label: "Edições", value: [...editions].join(", "), origin: "documented" }],
        sourceIds: ["duo-ordering-guide"],
        confidence: "high",
      });
    }
    return { findings, pending: [] };
  },
  sources,
  status: "validated",
  validatedAt: VALIDATED,
  validatedBy: "Pacote inicial VITA Lens",
  notes: ["Preços de lista públicos do Duo Ordering Guide, em USD por usuário por mês."],
};
