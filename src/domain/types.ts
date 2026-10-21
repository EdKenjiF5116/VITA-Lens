/**
 * Modelo de domínio do VITA Lens.
 *
 * O núcleo é o mesmo para qualquer fabricante. O conhecimento específico
 * (SKUs, níveis, funcionalidades, ciclo de vida, regras) fica em pacotes
 * de fabricante (src/packs), um arquivo por família de produtos.
 */

export type VendorId =
  | "cisco"
  | "fortinet"
  | "paloalto"
  | "hpe-aruba"
  | "huawei"
  | "watchguard";

export type ItemCategory =
  | "HARDWARE"
  | "SOFTWARE"
  | "LICENSE"
  | "SUBSCRIPTION"
  | "SUPPORT"
  | "SECURITY_SERVICE"
  | "CLOUD_SERVICE"
  | "ACCESSORY"
  | "PROFESSIONAL_SERVICE"
  | "UNKNOWN";

export type LicenseMetric =
  | "PER_USER"
  | "PER_ENDPOINT"
  | "PER_DEVICE"
  | "PER_AP"
  | "PER_INSTANCE"
  | "PER_CORE"
  | "PER_CPU"
  | "PER_CAPACITY"
  | "PER_THROUGHPUT"
  | "PER_SITE"
  | "PER_TENANT"
  | "PER_CONCURRENT_USER"
  | "CONSUMPTION_BASED"
  | "POINTS_BASED"
  | "HARDWARE_ATTACHED"
  | "ORGANIZATION_WIDE"
  | "CUSTOM";

/** Situação de um registro do catálogo. Rascunho reduz a confiança das conclusões. */
export type RecordStatus = "validated" | "draft";

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** Data (AAAA-MM-DD) em que a informação foi conferida. Vazio = fonte indicada, ainda não conferida. */
  accessedAt?: string;
  official: boolean;
  note?: string;
}

export interface Tier {
  id: string;
  name: string;
  /** Ordem crescente: 1 é o nível mais baixo. */
  rank: number;
  description?: string;
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  /** Níveis que incluem a funcionalidade. */
  tiers: string[];
  /** A adoção normalmente exige serviço de implantação. */
  needsService?: boolean;
  sourceIds: string[];
}

export interface Lifecycle {
  announcedAt?: string;
  endOfSaleAt?: string;
  /** Última data para contratar ou estender suporte/assinatura, quando o fabricante publica. */
  lastRenewalAt?: string;
  endOfSupportAt?: string;
  sourceIds: string[];
  status: RecordStatus;
  note?: string;
}

export interface Successor {
  model: string;
  sku: string;
  note?: string;
  status: RecordStatus;
}

export interface HardwareModel {
  /** Nome comercial do modelo, ex.: MR42, FG-60F, PA-850. */
  model: string;
  /** Part numbers que identificam o equipamento. */
  skus: string[];
  description: string;
  lifecycle?: Lifecycle;
  successors?: Successor[];
}

export type SkuKind = "hardware" | "base" | "upgrade" | "bundle" | "support" | "wrapper" | "addon" | "service";

export type DependencyType = "MANDATORY" | "CONDITIONAL" | "RECOMMENDED";

export interface Dependency {
  type: DependencyType;
  /** Descrição curta do que precisa existir. */
  requires: string;
  /** SKU ou tipo que satisfaz a dependência, quando aplicável. */
  satisfiedBy?: { kind?: SkuKind; skuPrefix?: string };
  note: string;
  /** Obrigatória no pedido (ex.: assinatura "guarda-chuva"), não no funcionamento. */
  forQuote?: boolean;
  sourceIds: string[];
}

export interface ListPrice {
  amount: number;
  currency: "USD" | "BRL";
  per: "unit" | "unit-month";
  sourceId: string;
}

export interface SkuRecord {
  sku: string;
  aliases?: string[];
  vendor: VendorId;
  familyId: string;
  category: ItemCategory;
  kind: SkuKind;
  description: string;
  tierId?: string;
  termMonths?: number;
  /** Modelo de hardware ao qual a licença está presa (licenças por equipamento). */
  model?: string;
  /** Segunda unidade de um par HA, quando o fabricante tem SKU próprio. */
  haSecondary?: boolean;
  /** Assinaturas avulsas (add-ons) que o SKU concede. Um pacote pode conceder várias. */
  entitlements?: string[];
  /** Agrupamento para contar cobertura por equipamento. Ex.: "protection" para bundles exclusivos. */
  serviceKey?: string;
  renewal?: boolean;
  legacy?: { replacedBy: string; note: string };
  dependencies?: Dependency[];
  listPrice?: ListPrice;
  status: RecordStatus;
  sourceIds: string[];
}

export type QuestionType = "number" | "select" | "multiselect" | "date" | "text";

export interface Question {
  /** Chave estável. Para perguntas por modelo, use o prefixo "model:" no escopo. */
  key: string;
  label: string;
  help?: string;
  type: QuestionType;
  options?: { value: string; label: string }[];
  /** "family": uma resposta para a família. "model": uma resposta por modelo de hardware. */
  scope: "family" | "model";
  /** Regras que dependem da resposta. Usado para priorizar pendências. */
  usedBy: string[];
  impact: "high" | "medium" | "low";
}

export interface FamilyRuleNote {
  id: string;
  name: string;
  description: string;
  sourceIds: string[];
}

/**
 * Pacote de uma família de produtos de um fabricante.
 * Ex.: Cisco Meraki MR, Fortinet FortiGate, Palo Alto NGFW.
 */
export interface FamilyPack {
  id: string;
  vendor: VendorId;
  vendorName: string;
  name: string;
  technology: string;
  metric: LicenseMetric;
  unit: { singular: string; plural: string };
  /** Licenciamento co-terminado: todas as licenças da organização vencem juntas. */
  coterm?: boolean;
  /** Níveis exclusivos e ordenados (Essentials, Advantage...). */
  tiers: Tier[];
  /** Assinaturas avulsas que podem ser combinadas (ex.: Palo Alto). */
  addons?: Tier[];
  features: Feature[];
  hardware: HardwareModel[];
  skus: SkuRecord[];
  /** Regras específicas da família, além das regras genéricas do motor. */
  extraRules?: (ctx: FamilyContext) => { findings: Finding[]; pending: PendingQuestion[] };
  /** Reconhece SKUs por padrão quando o catálogo não lista o código exato. */
  parseSku?: (sku: string) => Omit<SkuRecord, "sourceIds" | "status"> & { sourceIds?: string[]; status?: RecordStatus } | null;
  /** SKU de renovação para um nível, prazo e (se preciso) modelo. */
  renewalSku: (args: { tierId: string; termMonths: number; model?: string; haSecondary?: boolean }) => string | null;
  /** SKU de licença para equipamento novo (cenário de refresh). Padrão: renewalSku. */
  newDeviceSku?: (args: { tierId: string; termMonths: number; model?: string }) => string | null;
  supportedTerms: number[];
  questions: Question[];
  rules: FamilyRuleNote[];
  /** Textos do fabricante que o motor anexa a conclusões genéricas. */
  hints?: Partial<Record<"downgrade" | "upgrade" | "spares" | "ha" | "lifecycle" | "refresh", string>>;
  sources: Source[];
  status: RecordStatus;
  validatedAt: string;
  validatedBy: string;
  notes?: string[];
}

/* ---------- Dados de uma análise ---------- */

export type EvidenceOrigin = "declared" | "documented" | "collected" | "validated";
export type Confidence = "low" | "medium" | "high";

export type MatchStatus =
  | "recognized"
  | "partial"
  | "duplicate"
  | "inconsistent"
  | "unrecognized"
  | "pending";

export interface AnalysisItem {
  id: string;
  rawSku: string;
  rawDescription?: string | null;
  quantity: number;
  serial?: string | null;
  contractNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  unitPrice?: number | null;
  source: string;
  sourceRef?: string | null;
  /** Ajuste manual feito na tela de itens. */
  overrideSku?: string | null;
  ignored?: boolean;
}

export interface Answer {
  familyId: string;
  /** Modelo de hardware, para perguntas por modelo. */
  model?: string | null;
  questionKey: string;
  value: string;
  origin: EvidenceOrigin;
  evidence?: string | null;
  author?: string | null;
  updatedAt?: string | null;
}

export interface AnalysisInput {
  id: string;
  renewalDate?: string | null;
  termMonths: number;
  declaredFamilies: string[];
  items: AnalysisItem[];
  answers: Answer[];
  /** Decisões de revisão por chave de finding. */
  reviews: Record<string, { decision: ReviewDecision; comment?: string | null; findingHash?: string | null }>;
  prices: Record<string, number>;
  today: string;
}

export type ReviewDecision = "accepted" | "rejected" | "adjusted";

/* ---------- Resultado do motor ---------- */

export type Dimension = "data" | "quantity" | "tier" | "lifecycle" | "coverage" | "dependency" | "adoption";

export type Severity = "critical" | "attention" | "opportunity" | "ok" | "info";

export type RecommendationType =
  | "RENEW_AS_IS"
  | "ADJUST_QUANTITY"
  | "UPGRADE_LICENSE"
  | "POSSIBLE_DOWNGRADE"
  | "ADD_COVERAGE"
  | "CONSOLIDATE_CONTRACTS"
  | "REFRESH_HARDWARE"
  | "MIGRATE_PRODUCT"
  | "ENABLE_FEATURE"
  | "PROFESSIONAL_SERVICE"
  | "COLLECT_MORE_INFORMATION"
  | "MANUAL_REVIEW";

export interface EvidenceRef {
  label: string;
  value: string;
  origin: EvidenceOrigin;
  detail?: string;
}

export interface QuantityLedger {
  unitPlural: string;
  rows: { key: string; label: string; value: number | null; emphasis?: boolean }[];
  difference: number | null;
}

export interface Finding {
  key: string;
  familyId: string | null;
  dimension: Dimension;
  verdict: string;
  severity: Severity;
  title: string;
  explanation: string;
  recommendation?: { type: RecommendationType; text: string };
  affected: string[];
  rule: { id: string; name: string };
  evidence: EvidenceRef[];
  sourceIds: string[];
  confidence: Confidence;
  urgency?: "low" | "medium" | "high";
  ledger?: QuantityLedger;
  /** Dados estruturados que os cenários usam. */
  effect?: FindingEffect;
}

export type FindingEffect =
  | { kind: "quantity"; required: number; contracted: number; growth: number }
  | { kind: "tier"; suggestedTierId: string }
  | { kind: "refresh"; models: { model: string; quantity: number; successorSku?: string; successorModel?: string }[] }
  | { kind: "term-cap"; maxTermMonths: number }
  | { kind: "addons"; add: string[]; remove: string[] };

export interface PendingQuestion {
  answerKey: string;
  familyId: string;
  model?: string;
  questionKey: string;
  label: string;
  reason: string;
  impact: "high" | "medium" | "low";
}

export interface ResolvedItem extends AnalysisItem {
  effectiveSku: string;
  status: MatchStatus;
  statusNote?: string;
  /** Fabricante identificado, mesmo sem pacote de catálogo. */
  vendor?: string;
  vendorName?: string;
  familyId?: string;
  record?: SkuRecord;
  category: ItemCategory;
  model?: string;
}

export interface ScenarioLine {
  familyId: string;
  sku: string;
  description: string;
  quantity: number;
  termMonths?: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  change: "keep" | "adjust" | "replace" | "add" | "remove";
  reason: string;
}

export interface Scenario {
  id: "equivalent" | "optimized" | "refresh" | "expansion";
  name: string;
  summary: string;
  lines: ScenarioLine[];
  risks: string[];
  assumptions: string[];
  total: { amount: number; currency: "USD"; complete: boolean; missingPrices: string[] } | null;
}

/** Contexto que o motor entrega para as regras de uma família. */
export interface FamilyContext {
  pack: FamilyPack;
  input: AnalysisInput;
  /** Itens reconhecidos da família (sem ignorados, duplicados ou inconsistentes). */
  items: ResolvedItem[];
  hardwareItems: ResolvedItem[];
  licenseItems: ResolvedItem[];
  answer: (key: string, model?: string) => Answer | undefined;
  num: (key: string, model?: string) => number | null;
  str: (key: string, model?: string) => string | null;
  list: (key: string, model?: string) => string[] | null;
  today: string;
}

export interface FamilyResult {
  familyId: string;
  findings: Finding[];
  pending: PendingQuestion[];
}

export interface AnalysisResult {
  items: ResolvedItem[];
  families: FamilyResult[];
  general: Finding[];
  scenarios: Scenario[];
  summary: {
    itemCount: number;
    recognized: number;
    unrecognized: number;
    critical: number;
    attention: number;
    opportunity: number;
    pendingHigh: number;
    pendingTotal: number;
    lifecycleAttention: number;
    expiringIn90: number;
  };
}
