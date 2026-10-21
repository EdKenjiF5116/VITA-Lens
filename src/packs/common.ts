import type { Feature, Question } from "@/domain/types";

/** Chaves de pergunta usadas pelo motor. Os pacotes reutilizam estas chaves. */
export const Q = {
  unitsInstalled: "units.installed",
  unitsActive: "units.active",
  unitsSpare: "units.spare",
  sparesLicensed: "spares.licensed",
  unitsHaSecondary: "units.ha_secondary",
  growthUnits: "growth.units",
  usersRegistered: "users.registered",
  usersActive: "users.active",
  inactivePolicy: "inactive.policy",
  growthUsers: "growth.users",
  featuresUsed: "features.used",
  featuresPlanned: "features.planned",
  eoxEndOfSale: "eox.endOfSaleAt",
  eoxEndOfSupport: "eox.endOfSupportAt",
  firmware: "firmware.version",
  licensingModel: "licensing.model",
  /** Coletadas por conector (não aparecem como perguntas). */
  licensesContracted: "licenses.contracted",
  licensesEdition: "licenses.edition",
  licensesExpiration: "licenses.expiration",
  unitsOnline: "units.online",
} as const;

export const yesNoUnknown = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
  { value: "unknown", label: "Não sei" },
];

function featureOptions(features: Feature[]) {
  return features.map((f) => ({ value: f.id, label: f.name }));
}

export function featureQuestions(features: Feature[], unitPlural: string): Question[] {
  return [
    {
      key: Q.featuresUsed,
      label: "Quais recursos o cliente usa hoje?",
      help: `Marque só o que tem evidência de uso no ambiente de ${unitPlural}. O motor compara com o nível contratado.`,
      type: "multiselect",
      options: featureOptions(features),
      scope: "family",
      usedBy: ["TIER-01", "ADOPT-01"],
      impact: "high",
    },
    {
      key: Q.featuresPlanned,
      label: "Quais recursos estão planejados para o próximo período?",
      help: "Projetos confirmados ou em avaliação. Evita recomendar um downgrade que travaria o projeto.",
      type: "multiselect",
      options: featureOptions(features),
      scope: "family",
      usedBy: ["TIER-01", "SCN-EXP"],
      impact: "medium",
    },
  ];
}

export function lifecycleQuestions(): Question[] {
  return [
    {
      key: Q.eoxEndOfSale,
      label: "Fim de venda do modelo",
      help: "Preencha só se o catálogo não tiver a data ou se o portal do fabricante mostrar outra.",
      type: "date",
      scope: "model",
      usedBy: ["LIFE-01"],
      impact: "low",
    },
    {
      key: Q.eoxEndOfSupport,
      label: "Fim de suporte do modelo",
      help: "Data em que o fabricante encerra suporte, RMA e atualizações.",
      type: "date",
      scope: "model",
      usedBy: ["LIFE-01", "LIFE-02"],
      impact: "medium",
    },
  ];
}

/** Perguntas para licenças por equipamento gerenciado (APs, switches, sensores). */
export function unitQuestions(opts: {
  unitSingular: string;
  unitPlural: string;
  sparesHelp?: string;
  features: Feature[];
}): Question[] {
  const { unitPlural } = opts;
  return [
    {
      key: Q.unitsInstalled,
      label: `Quantos ${unitPlural} existem no parque?`,
      help: "Inclui ativos e de contingência. Se a planilha trouxe os equipamentos, o motor sugere o total.",
      type: "number",
      scope: "family",
      usedBy: ["QTY-01", "COV-02"],
      impact: "high",
    },
    {
      key: Q.unitsActive,
      label: `Quantos ${unitPlural} estão em uso?`,
      help: "Equipamentos em produção, recebendo clientes ou tráfego.",
      type: "number",
      scope: "family",
      usedBy: ["QTY-01"],
      impact: "high",
    },
    {
      key: Q.unitsSpare,
      label: `Quantos ${unitPlural} estão guardados como contingência?`,
      type: "number",
      scope: "family",
      usedBy: ["QTY-01"],
      impact: "medium",
    },
    {
      key: Q.sparesLicensed,
      label: "Os equipamentos de contingência precisam de licença ativa?",
      help: opts.sparesHelp,
      type: "select",
      options: yesNoUnknown,
      scope: "family",
      usedBy: ["QTY-01"],
      impact: "medium",
    },
    {
      key: Q.growthUnits,
      label: `Quantos ${unitPlural} novos estão previstos no período?`,
      type: "number",
      scope: "family",
      usedBy: ["SCN-EXP"],
      impact: "low",
    },
    ...featureQuestions(opts.features, unitPlural),
    ...lifecycleQuestions(),
  ];
}

/** Perguntas para licenças presas a um equipamento (firewalls). Respostas por modelo. */
export function attachedQuestions(opts: { features: Feature[]; haHelp: string }): Question[] {
  return [
    {
      key: Q.unitsInstalled,
      label: "Equipamentos instalados",
      type: "number",
      scope: "model",
      usedBy: ["QTY-02"],
      impact: "high",
    },
    {
      key: Q.unitsActive,
      label: "Em produção",
      help: "Inclui as duas unidades de um par em alta disponibilidade.",
      type: "number",
      scope: "model",
      usedBy: ["QTY-02"],
      impact: "high",
    },
    {
      key: Q.unitsHaSecondary,
      label: "Unidades secundárias de HA",
      help: opts.haHelp,
      type: "number",
      scope: "model",
      usedBy: ["QTY-02"],
      impact: "medium",
    },
    {
      key: Q.unitsSpare,
      label: "Em estoque ou contingência",
      type: "number",
      scope: "model",
      usedBy: ["QTY-02"],
      impact: "low",
    },
    {
      key: Q.sparesLicensed,
      label: "Os equipamentos de contingência precisam de assinatura ativa?",
      type: "select",
      options: yesNoUnknown,
      scope: "family",
      usedBy: ["QTY-02"],
      impact: "low",
    },
    {
      key: Q.growthUnits,
      label: "Quantos equipamentos novos estão previstos no período?",
      type: "number",
      scope: "family",
      usedBy: ["SCN-EXP"],
      impact: "low",
    },
    ...featureQuestions(opts.features, "firewalls"),
    ...lifecycleQuestions(),
  ];
}

/** Perguntas para licenças por usuário (identidade, MFA, SSE). */
export function userQuestions(features: Feature[], registeredHelp: string): Question[] {
  return [
    {
      key: Q.usersRegistered,
      label: "Quantos usuários estão cadastrados?",
      help: registeredHelp,
      type: "number",
      scope: "family",
      usedBy: ["QTY-03"],
      impact: "high",
    },
    {
      key: Q.usersActive,
      label: "Quantos usuários autenticaram nos últimos 90 dias?",
      type: "number",
      scope: "family",
      usedBy: ["QTY-03"],
      impact: "high",
    },
    {
      key: Q.inactivePolicy,
      label: "Qual é a política para usuários inativos?",
      help: "Sem essa política o motor não recomenda reduzir para o número de ativos.",
      type: "select",
      options: [
        { value: "remove", label: "Inativos podem ser removidos antes da renovação" },
        { value: "keep", label: "Inativos precisam continuar cadastrados" },
        { value: "unknown", label: "Ainda não definida" },
      ],
      scope: "family",
      usedBy: ["QTY-03"],
      impact: "high",
    },
    {
      key: Q.growthUsers,
      label: "Quantos usuários novos estão previstos no período?",
      type: "number",
      scope: "family",
      usedBy: ["SCN-EXP"],
      impact: "low",
    },
    ...featureQuestions(features, "usuários"),
  ];
}
