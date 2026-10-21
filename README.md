# VITA Lens

Plataforma web para análise de renovações de hardware, licenças, assinaturas e suporte em ambientes de infraestrutura e segurança, para várias marcas.

O pré-vendas entrega a situação atual do cliente (SKUs, part numbers, contratos, equipamentos e como ele usa a solução). O VITA Lens organiza, confere e explica o que deve ser renovado, ajustado, substituído ou mais bem aproveitado. Toda conclusão vem com regra aplicada, evidência, fonte e nível de confiança, e passa pela revisão de um especialista antes de virar proposta.

> Protótipo funcional. Os clientes e análises carregados na primeira execução são fictícios.

## O que o protótipo faz

O fluxo de uma análise tem sete etapas:

1. **Importação**: planilha Excel ou CSV com mapeamento de colunas e prévia, texto colado de e-mail ou PDF, item manual e coleta pela API do fabricante (conector Meraki, com modo de demonstração).
2. **Itens**: cada linha recebe um estado (reconhecida, parcial, duplicada, inconsistente, não reconhecida). Nada é descartado: o usuário corrige o SKU, ignora ou deixa para revisão manual.
3. **Utilização**: perguntas que mudam conforme o produto (por access point, por usuário, por firewall). Cada resposta guarda origem (declarada, documentada, coletada, validada) e evidência.
4. **Resultados**: o motor de regras responde se a quantidade está adequada, se o nível da licença corresponde ao uso, se há equipamento fora de suporte ou renovação além do fim de suporte, se faltam dependências e quais recursos incluídos não são usados. Também lista o que falta perguntar ao cliente.
5. **Cenários**: renovação equivalente, otimizada, com refresh e expansão, com SKUs de renovação, quantidades, prazos e preço (lista pública ou informado).
6. **Revisão**: o especialista aceita, ajusta ou rejeita cada recomendação. Rejeitadas saem dos cenários; downgrades só entram depois de aceitos.
7. **Relatório**: resumo executivo, ambiente, inconsistências, recomendações com a decisão do revisor, cenários, pendências e fontes. Imprime em PDF e exporta CSV e JSON.

## Fabricantes

O núcleo é o mesmo para todas as marcas. O conhecimento de cada uma fica em um pacote (`src/packs`).

| Fabricante | Família | Licenciamento | Catálogo |
| --- | --- | --- | --- |
| Cisco | Meraki MR (wireless) | Por access point, co-term ou assinatura | Validado |
| Cisco | Duo (identidade e MFA) | Por usuário | Validado |
| Fortinet | FortiGate | Bundle por equipamento (FortiCare, ATP, UTP, Enterprise) | Rascunho |
| Palo Alto Networks | NGFW | Assinaturas por equipamento, com SKU de HA | Rascunho (ciclo de vida validado) |
| HPE Aruba Networking | Central (APs) | Assinatura por access point | Rascunho (recursos validados) |
| WatchGuard | Firebox | Suítes por equipamento | Validado (SKUs parciais) |
| Huawei | WLAN (CloudCampus N1) | Por access point | Rascunho |

Check Point, Sophos, Juniper e Extreme são reconhecidos pelo formato do part number e vão para revisão manual até ganharem um pacote.

"Validado" quer dizer que os dados foram conferidos em fontes oficiais do fabricante (listadas em cada pacote, com a data de consulta). "Rascunho" quer dizer que parte dos dados veio de fontes não oficiais ou ainda não foi conferida. O motor usa a situação do catálogo para limitar a confiança das conclusões e nunca inventa datas de ciclo de vida: sem fonte, o modelo aparece como "ciclo de vida não confirmado" e vira pendência.

## Como rodar

Requisitos: Node.js 20.9 ou mais recente.

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Na primeira execução o VITA Lens cria o banco e carrega três análises de demonstração.

O banco padrão é um PostgreSQL embutido (PGlite) salvo em `.data/pglite`, sem instalar nada. Para usar um PostgreSQL de verdade, defina `DATABASE_URL` (veja `.env.example`).

Outros comandos:

```bash
npm test          # testes do motor de regras (vitest)
npm run build     # build de produção
npm start         # servidor de produção
npm run db:reset  # apaga o banco local; a próxima execução recria os dados de demonstração
```

Arquivos para testar a importação estão em `samples/` (um CSV com várias marcas e uma planilha Excel com o cabeçalho na linha 3).

## Arquitetura

```
src/
  domain/types.ts      modelo de domínio (itens, respostas, achados, cenários, pacotes)
  packs/               um arquivo por família de produtos + registro e detecção de fabricante
  engine/              motor determinístico
    match.ts           normalização e reconhecimento de SKU
    rules/             quantidade, nível, ciclo de vida, cobertura, dependências e adoção
    scenarios.ts       cenários equivalente, otimizado, refresh e expansão
    extract.ts         extração de SKUs de texto livre
    run.ts             orquestração e resumo
  connectors/meraki.ts coleta pela Meraki Dashboard API (evidência "coletada")
  db/                  Drizzle ORM, esquema, migrações e dados de demonstração
  app/                 telas (Next.js App Router) e server actions
tests/                 testes do motor com os casos do documento de produto
drizzle/               migrações SQL
```

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM com PostgreSQL (PGlite embutido ou servidor), Vitest.

### Princípios

- O motor de regras calcula. A base validada fundamenta. O especialista aprova.
- Cada conclusão é rastreável: regra, evidência, fonte e confiança.
- A confiança vem da evidência mais fraca usada e da situação do catálogo, não de um modelo de IA.
- "Não foi possível determinar" é uma resposta válida e vira pendência para o cliente.
- O sistema não promete identificar a licença correta automaticamente. Ele recomenda cenários com base nas informações fornecidas, nas regras cadastradas e nas fontes disponíveis.

## Como adicionar um fabricante

1. Crie `src/packs/<fabricante>-<familia>.ts` exportando um `FamilyPack`: níveis ou assinaturas, recursos por nível, modelos com ciclo de vida e sucessores, SKUs (lista e, se fizer sentido, um `parseSku` pelo padrão do part number), função `renewalSku`, perguntas (use os modelos de `src/packs/common.ts`), regras específicas e fontes com data de consulta.
2. Registre o pacote em `src/packs/index.ts`.
3. Escreva testes em `tests/` com um caso real da família.

O motor, as telas e o relatório passam a reconhecer a família sem outras mudanças.

## Limitações do protótipo

- Sem login, perfis e separação entre empresas.
- Preços: só o Duo tem preço de lista público no catálogo. Os demais preços são informados na tela de cenários. Não há margem, desconto ou cotação automática.
- Conector Meraki em beta: testado com respostas simuladas no formato da API. Validar com uma organização real (chave somente leitura).
- Sucessores de hardware marcados como "sugestão" precisam de validação técnica.
- Ainda sem IA. Ela entra depois, para extrair dados de documentos, sugerir perguntas e redigir textos, sem decidir licenciamento.

## Próximos passos

- Conectores para outros portais (Fortinet, Palo Alto, Aruba Central, CX Cloud da Cisco).
- Conferir os pacotes em rascunho com as fontes oficiais e incluir ciclo de vida de Fortinet, Aruba e Huawei.
- Autenticação, perfis (pré-vendas, revisor, gestor) e trilha de auditoria completa.
- Medir em oportunidades reais: tempo manual contra tempo na plataforma, percentual de SKUs reconhecidos e recomendações aceitas e rejeitadas.

## Fontes usadas nos pacotes

Cada pacote lista as próprias fontes, com a data de consulta, na tela de catálogo. As principais:

- Cisco Meraki: MR License Guide, Co-Termination Licensing Overview, End-of-Life Products and Dates.
- Cisco: Networking Subscription Data Sheet e Duo Ordering Guide.
- Palo Alto Networks: Hardware End-of-Life Dates.
- WatchGuard: End of Life Policy e Security Services.
- HPE Aruba Networking: AP Foundation and Advanced License.
