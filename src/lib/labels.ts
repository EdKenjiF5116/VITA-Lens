import type { Confidence, Dimension, EvidenceOrigin, ItemCategory, LicenseMetric, MatchStatus, RecommendationType, Severity } from "@/domain/types";

export const STATUS: Record<string, string> = {
  DRAFT: "Rascunho",
  COLLECTING_DATA: "Coletando informações",
  WAITING_CUSTOMER: "Aguardando cliente",
  PROCESSING: "Em processamento",
  NEEDS_REVIEW: "Necessita revisão",
  TECHNICALLY_REVIEWED: "Revisada tecnicamente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  EXPORTED: "Relatório exportado",
  ARCHIVED: "Arquivada",
};
export const OPEN_STATUSES = ["DRAFT", "COLLECTING_DATA", "WAITING_CUSTOMER", "PROCESSING", "NEEDS_REVIEW", "TECHNICALLY_REVIEWED"];

export const SEVERITY: Record<Severity, string> = {
  critical: "Crítico",
  attention: "Atenção",
  opportunity: "Oportunidade",
  ok: "Adequado",
  info: "Informativo",
};

export const VERDICT: Record<string, string> = {
  ADEQUATE: "Adequada",
  POSSIBLE_SURPLUS: "Aparentemente excedente",
  POSSIBLE_DEFICIT: "Aparentemente insuficiente",
  UNDETERMINED: "Não foi possível determinar",
  NEEDS_VALIDATION: "Exige validação",
  POSSIBLE_DOWNGRADE: "Possível downgrade",
  UPGRADE_REQUIRED: "Upgrade necessário",
  UPGRADE_FOR_PLAN: "Upgrade para projeto",
  ADOPTION_OPPORTUNITY: "Oportunidade de adoção",
  ACTIVE: "Ativo",
  EOS_ANNOUNCED: "Fim de venda anunciado",
  RENEWAL_RESTRICTED: "Renovação com restrição",
  REFRESH_RECOMMENDED: "Refresh recomendado",
  REFRESH_REQUIRED: "Refresh necessário",
  END_OF_SUPPORT: "Fora de suporte",
  UNKNOWN: "Ciclo de vida não confirmado",
  EXPIRED: "Vencido",
  EXPIRING: "Vencendo",
  DIVERGENT_DATES: "Datas divergentes",
  NO_COVERAGE: "Sem cobertura",
  MISSING_DATA: "Dado ausente",
  MANDATORY_DEPENDENCY: "Dependência obrigatória",
  CONDITIONAL_DEPENDENCY: "Dependência condicional",
  RECOMMENDED_ITEM: "Recomendação",
  MIGRATE: "Migração de SKU",
  INCONSISTENT: "Inconsistência",
  UNRECOGNIZED: "Não reconhecido",
};

export const RECOMMENDATION: Record<RecommendationType, string> = {
  RENEW_AS_IS: "Renovar como está",
  ADJUST_QUANTITY: "Ajustar quantidade",
  UPGRADE_LICENSE: "Elevar nível",
  POSSIBLE_DOWNGRADE: "Avaliar nível inferior",
  ADD_COVERAGE: "Adicionar cobertura",
  CONSOLIDATE_CONTRACTS: "Consolidar contratos",
  REFRESH_HARDWARE: "Atualizar equipamento",
  MIGRATE_PRODUCT: "Migrar produto",
  ENABLE_FEATURE: "Avaliar ativação",
  PROFESSIONAL_SERVICE: "Serviço profissional",
  COLLECT_MORE_INFORMATION: "Coletar informações",
  MANUAL_REVIEW: "Revisão especializada",
};

export const DIMENSION: Record<Dimension, string> = {
  data: "Qualidade dos dados",
  quantity: "Quantidade",
  tier: "Nível da licença",
  lifecycle: "Ciclo de vida",
  coverage: "Cobertura",
  dependency: "Dependências",
  adoption: "Adoção",
};
export const DIMENSION_ORDER: Dimension[] = ["quantity", "tier", "lifecycle", "coverage", "dependency", "adoption", "data"];

export const ORIGIN: Record<EvidenceOrigin, string> = {
  declared: "Declarada",
  documented: "Documentada",
  collected: "Coletada",
  validated: "Validada",
};
export const ORIGIN_HELP: Record<EvidenceOrigin, string> = {
  declared: "Informada pelo usuário ou pelo cliente.",
  documented: "Extraída de contrato, planilha, relatório ou proposta.",
  collected: "Obtida por API, portal ou ferramenta de gestão.",
  validated: "Revisada e aprovada por um especialista.",
};

export const CONFIDENCE: Record<Confidence, string> = { low: "Baixa", medium: "Média", high: "Alta" };

export const MATCH: Record<MatchStatus, string> = {
  recognized: "Reconhecida",
  partial: "Reconhecida parcialmente",
  duplicate: "Duplicada",
  inconsistent: "Inconsistente",
  unrecognized: "Não reconhecida",
  pending: "Aguardando validação",
};

export const MATCH_PLURAL: Record<MatchStatus, string> = {
  recognized: "reconhecidas",
  partial: "reconhecidas parcialmente",
  duplicate: "duplicadas",
  inconsistent: "inconsistentes",
  unrecognized: "não reconhecidas",
  pending: "aguardando validação",
};

export const CATEGORY: Record<ItemCategory, string> = {
  HARDWARE: "Hardware",
  SOFTWARE: "Software",
  LICENSE: "Licença",
  SUBSCRIPTION: "Assinatura",
  SUPPORT: "Suporte",
  SECURITY_SERVICE: "Serviço de segurança",
  CLOUD_SERVICE: "Serviço em nuvem",
  ACCESSORY: "Acessório",
  PROFESSIONAL_SERVICE: "Serviço profissional",
  UNKNOWN: "Não identificado",
};

export const METRIC: Record<LicenseMetric, string> = {
  PER_USER: "Por usuário",
  PER_ENDPOINT: "Por endpoint",
  PER_DEVICE: "Por equipamento",
  PER_AP: "Por access point",
  PER_INSTANCE: "Por instância",
  PER_CORE: "Por núcleo",
  PER_CPU: "Por processador",
  PER_CAPACITY: "Por capacidade",
  PER_THROUGHPUT: "Por throughput",
  PER_SITE: "Por unidade",
  PER_TENANT: "Por tenant",
  PER_CONCURRENT_USER: "Por usuário simultâneo",
  CONSUMPTION_BASED: "Por consumo",
  POINTS_BASED: "Por pontos ou créditos",
  HARDWARE_ATTACHED: "Vinculada ao equipamento",
  ORGANIZATION_WIDE: "Toda a organização",
  CUSTOM: "Métrica do fabricante",
};

export const SOURCE_LABEL: Record<string, string> = {
  xlsx: "Planilha",
  csv: "Planilha",
  paste: "Texto colado",
  manual: "Manual",
  "meraki-api": "Meraki API",
};

export const CHANGE: Record<string, string> = {
  keep: "Mantém",
  adjust: "Ajusta",
  replace: "Substitui",
  add: "Adiciona",
  remove: "Retira",
};
