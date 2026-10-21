import { loadAnalysis, reviewState, allFindings, familyName, vendorsOf } from "@/lib/load";
import { listAudit } from "@/db/repo";
import { setStatusAction } from "@/app/actions";
import { findSource, getPack } from "@/packs";
import { formatDate, todayIso } from "@/lib/dates";
import { CATEGORY, DIMENSION, RECOMMENDATION, STATUS, VERDICT, CONFIDENCE } from "@/lib/labels";
import { money } from "@/lib/format";
import { LensMark, SeverityTag, EvidenceMark } from "@/components/ui";
import { PrintButton, SubmitButton } from "@/components/client";
import { needsReview } from "@/engine/run";

export const metadata = { title: "Relatório" };

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-2 border-b-2 border-vivo pb-1 text-[1.15rem] font-bold">{children}</h2>;
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { analysis, client, result, reviews, input } = await loadAnalysis(id);
  const log = await listAudit(id);
  const { byKey, toReview, done } = reviewState(result, reviews);
  const s = result.summary;
  const findings = allFindings(result);
  const recs = findings.filter(needsReview);
  const inconsist = findings.filter((f) => f.dimension === "data" || f.verdict === "INCONSISTENT");
  const pending = result.families.flatMap((f) => f.pending);
  const sourceIds = [...new Set(findings.flatMap((f) => f.sourceIds))];
  const sources = sourceIds.map(findSource).filter(Boolean);
  const live = result.items.filter((i) => !i.ignored);
  const famIds = [...new Set(live.map((i) => i.familyId ?? "outros"))];

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="lead">Relatório pronto para impressão ou PDF. Reúne ambiente, inconsistências, recomendações com a decisão do revisor, cenários, pendências e fontes.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-secondary" href={`/api/analyses/${id}/export?format=json`}>
            Exportar JSON
          </a>
          <form action={setStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="EXPORTED" />
            <SubmitButton className="btn btn-secondary">Marcar como exportado</SubmitButton>
          </form>
          <PrintButton />
        </div>
      </div>

      <article className="panel px-6 py-8 md:px-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="flex items-center gap-2 text-[0.85rem] font-bold text-vivo">
              <span className="rounded-full bg-plum p-0.5">
                <LensMark size={16} />
              </span>
              VITA Lens
            </p>
            <h1 className="mt-2 text-[1.6rem] font-bold leading-tight">{analysis.name}</h1>
            <p className="text-muted">{client.name}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[0.85rem]">
            <dt className="text-muted">Emitido em</dt>
            <dd>{formatDate(todayIso())}</dd>
            <dt className="text-muted">Renovação</dt>
            <dd>{formatDate(analysis.renewalDate)}</dd>
            <dt className="text-muted">Prazo pretendido</dt>
            <dd>{analysis.termMonths} meses</dd>
            <dt className="text-muted">Status</dt>
            <dd>{STATUS[analysis.status]}</dd>
          </dl>
        </header>

        <p className="mt-4 rounded-md bg-mist px-4 py-3 text-[0.85rem]">
          Análise preliminar gerada a partir das informações fornecidas, das regras cadastradas e das fontes listadas. As recomendações estão sujeitas à validação de um especialista.
          {toReview.length > 0 && ` Revisão: ${done.length} de ${toReview.length} recomendações decididas.`}
        </p>

        <H>Resumo executivo</H>
        <ul className="grid gap-1 text-[0.92rem] sm:grid-cols-2">
          <li>
            <strong className="num">{s.itemCount}</strong> itens analisados, <strong className="num">{s.recognized}</strong> reconhecidos pelo catálogo
          </li>
          <li>Fabricantes: {vendorsOf(result).join(", ") || "nenhum"}</li>
          <li>
            <strong className="num">{s.expiringIn90}</strong> contratos vencendo em até 90 dias
          </li>
          <li>
            <strong className="num">{s.critical}</strong> pontos críticos e <strong className="num">{s.opportunity}</strong> oportunidades
          </li>
          <li>
            <strong className="num">{s.lifecycleAttention}</strong> alertas de ciclo de vida
          </li>
          <li>
            <strong className="num">{s.pendingTotal}</strong> pendências de informação ({s.pendingHigh} de alto impacto)
          </li>
        </ul>

        <H>Ambiente atual</H>
        {famIds.map((fid) => {
          const its = live.filter((i) => (i.familyId ?? "outros") === fid);
          return (
            <div key={fid} className="mb-4 break-inside-avoid">
              <h3 className="h-sub mb-1">{fid === "outros" ? "Itens sem pacote de catálogo" : familyName(fid)}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th className="right">Qtd</th>
                    <th>Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {groupBySku(its).map((g) => (
                    <tr key={g.sku}>
                      <td className="sku">{g.sku}</td>
                      <td className="text-[0.84rem]">{g.description}</td>
                      <td className="text-[0.84rem]">{CATEGORY[g.category]}</td>
                      <td className="right num">{g.quantity}</td>
                      <td className="text-[0.84rem]">{g.endDates.map((d) => formatDate(d)).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {inconsist.length > 0 && (
          <>
            <H>Inconsistências</H>
            <ul className="grid gap-2 text-[0.9rem]">
              {inconsist.map((f) => (
                <li key={f.key}>
                  <strong>{f.title}.</strong> <span className="text-muted">{f.explanation}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <H>Recomendações</H>
        <table className="table">
          <thead>
            <tr>
              <th>Conclusão</th>
              <th>Ação</th>
              <th>Evidência e confiança</th>
              <th>Revisão</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((f) => {
              const r = byKey.get(f.key);
              return (
                <tr key={f.key} className="break-inside-avoid">
                  <td className="min-w-56">
                    <SeverityTag severity={f.severity} />
                    <div className="mt-1 font-bold">{f.title}</div>
                    <div className="text-[0.8rem] text-muted">
                      {familyName(f.familyId)}, {DIMENSION[f.dimension].toLowerCase()}, {VERDICT[f.verdict]?.toLowerCase() ?? f.verdict}
                    </div>
                  </td>
                  <td className="text-[0.85rem]">
                    {f.recommendation && (
                      <>
                        <strong>{RECOMMENDATION[f.recommendation.type]}.</strong> {f.recommendation.text}
                      </>
                    )}
                  </td>
                  <td className="text-[0.8rem]">
                    <div className="flex flex-wrap gap-x-2">
                      {[...new Set(f.evidence.map((e) => e.origin))].map((o) => (
                        <EvidenceMark key={o} origin={o} />
                      ))}
                    </div>
                    Confiança {CONFIDENCE[f.confidence].toLowerCase()}. Regra {f.rule.id}.
                  </td>
                  <td className="text-[0.82rem]">{r ? `${r.decision === "accepted" ? "Aceita" : r.decision === "rejected" ? "Rejeitada" : "Ajustada"}${r.reviewer ? ` por ${r.reviewer}` : ""}${r.comment ? `: ${r.comment}` : ""}` : <span className="text-warn">Pendente</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <H>Cenários</H>
        <table className="table">
          <thead>
            <tr>
              <th>Cenário</th>
              <th>O que muda</th>
              <th className="right">Linhas</th>
              <th className="right">Total (USD)</th>
            </tr>
          </thead>
          <tbody>
            {result.scenarios.map((sc) => (
              <tr key={sc.id}>
                <td className="font-bold">{sc.name}</td>
                <td className="text-[0.84rem] text-muted">
                  {sc.summary}
                  {sc.risks.length > 0 && <div className="mt-1 text-crit">Riscos: {sc.risks.join(" ")}</div>}
                </td>
                <td className="right num">{sc.lines.length}</td>
                <td className="right num">{sc.total ? `${money(sc.total.amount)}${sc.total.complete ? "" : " (parcial)"}` : "sem preço"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint mt-1">Lista completa de cada cenário na exportação CSV.</p>

        <H>Pendências</H>
        {pending.length === 0 ? (
          <p className="text-[0.9rem] text-muted">Sem pendências.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Informação ausente</th>
                <th>Família</th>
                <th>Impacto</th>
                <th>Por que importa</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.answerKey}>
                  <td className="font-bold">{p.label}</td>
                  <td className="text-[0.84rem]">{getPack(p.familyId)?.name}</td>
                  <td className="text-[0.84rem]">{p.impact === "high" ? "Alto" : p.impact === "medium" ? "Médio" : "Baixo"}</td>
                  <td className="text-[0.84rem] text-muted">{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <H>Fontes</H>
        <ul className="grid gap-1.5 text-[0.85rem]">
          {sources.map((src) => (
            <li key={src!.id}>
              <strong>{src!.title}</strong>, {src!.publisher}
              {src!.official ? "" : " (fonte não oficial)"}. <a className="link break-all" href={src!.url}>{src!.url}</a>
              {src!.accessedAt ? `. Consultada em ${formatDate(src!.accessedAt)}.` : ". Ainda não conferida."}
            </li>
          ))}
          {sources.length === 0 && <li className="text-muted">Nenhuma fonte de catálogo usada.</li>}
        </ul>

        <H>Aprovação</H>
        <ul className="grid gap-1 text-[0.85rem]">
          {log
            .filter((l) => /Recomendação|Status|criada|Revisão/.test(l.action))
            .map((l) => (
              <li key={l.id}>
                {l.at.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}: {l.action}
                {l.detail ? ` (${STATUS[l.detail] ?? l.detail})` : ""}, {l.actor}
              </li>
            ))}
        </ul>
        <p className="hint mt-6">Dados de entrada: {input.items.length} linhas importadas e {input.answers.length} respostas de utilização.</p>
      </article>
    </div>
  );
}

function groupBySku(items: { effectiveSku: string; quantity: number; record?: { description: string }; rawDescription?: string | null; category: keyof typeof CATEGORY; endDate?: string | null }[]) {
  const m = new Map<string, { sku: string; description: string; category: keyof typeof CATEGORY; quantity: number; endDates: string[] }>();
  for (const i of items) {
    const g = m.get(i.effectiveSku) ?? { sku: i.effectiveSku, description: i.record?.description ?? i.rawDescription ?? "", category: i.category, quantity: 0, endDates: [] };
    g.quantity += i.quantity;
    if (i.endDate && !g.endDates.includes(i.endDate)) g.endDates.push(i.endDate);
    m.set(i.effectiveSku, g);
  }
  return [...m.values()];
}
