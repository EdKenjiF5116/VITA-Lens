import Link from "next/link";
import { loadAnalysis, reviewState, allFindings } from "@/lib/load";
import { listAudit } from "@/db/repo";
import { updateAnalysisAction } from "@/app/actions";
import { Stat } from "@/components/ui";
import { FindingRow } from "@/components/finding";
import { SubmitButton } from "@/components/client";
import { FamilyPicker, TermSelect } from "@/components/forms";

export const metadata = { title: "Resumo" };

export default async function AnalysisSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { analysis, result, reviews } = await loadAnalysis(id);
  const log = await listAudit(id);
  const rv = reviewState(result, reviews);
  const s = result.summary;
  const base = `/app/analyses/${id}`;

  const next =
    s.itemCount === 0
      ? { href: `${base}/import`, title: "Importe os itens do cliente", body: "Planilha, texto de e-mail, preenchimento manual ou coleta pela API do fabricante." }
      : s.unrecognized > 0
        ? { href: `${base}/items`, title: `Revise ${s.unrecognized} ${s.unrecognized === 1 ? "item não reconhecido" : "itens não reconhecidos"}`, body: "Corrija o SKU ou marque como ignorado. Nada é descartado sem decisão." }
        : s.pendingHigh > 0
          ? { href: `${base}/discovery`, title: `Responda ${s.pendingHigh} ${s.pendingHigh === 1 ? "pergunta de alto impacto" : "perguntas de alto impacto"}`, body: "São as respostas que mudam a conclusão sobre quantidade e nível." }
          : rv.toReview.length > rv.done.length
            ? { href: `${base}/review`, title: `Revise ${rv.toReview.length - rv.done.length} ${rv.toReview.length - rv.done.length === 1 ? "recomendação" : "recomendações"}`, body: "Aceite, ajuste ou rejeite. Os cenários usam só o que não foi rejeitado." }
            : { href: `${base}/report`, title: "Gere o relatório", body: "Análise revisada. O relatório reúne cenários, pendências e fontes." };

  const top = allFindings(result)
    .filter((f) => f.severity === "critical" || f.severity === "attention")
    .slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-6">
        <Link href={next.href} className="panel block border-vivo/40 bg-vivo-50 px-5 py-4 hover:border-vivo">
          <span className="text-[0.82rem] font-bold text-vivo">Próximo passo</span>
          <span className="mt-0.5 block text-[1.1rem] font-bold">{next.title}</span>
          <span className="mt-0.5 block text-[0.9rem] text-muted">{next.body}</span>
        </Link>

        <section className="panel grid grid-cols-2 sm:grid-cols-3">
          <Stat label="Itens analisados" value={s.itemCount} href={`${base}/items`} />
          <Stat label="Reconhecidos pelo catálogo" value={s.recognized} href={`${base}/items`} />
          <Stat label="Contratos vencendo em 90 dias" value={s.expiringIn90} tone={s.expiringIn90 ? "attention" : undefined} />
          <Stat label="Críticos" value={s.critical} href={`${base}/results`} tone={s.critical ? "critical" : undefined} />
          <Stat label="Oportunidades" value={s.opportunity} href={`${base}/results`} tone={s.opportunity ? "opportunity" : undefined} />
          <Stat label="Pendências de informação" value={s.pendingTotal} href={`${base}/discovery`} />
        </section>

        {top.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="h-section">O que pede atenção</h2>
              <Link href={`${base}/results`} className="link text-[0.88rem]">
                Ver todos os resultados
              </Link>
            </div>
            <div className="panel">
              {top.map((f) => (
                <FindingRow key={f.key} f={f} compact />
              ))}
            </div>
          </section>
        )}

        <details className="panel">
          <summary className="cursor-pointer px-5 py-4 font-bold">Dados da análise</summary>
          <form action={updateAnalysisAction} className="grid gap-4 border-t border-line p-5">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="field md:col-span-2">
                <label className="label" htmlFor="name">
                  Nome
                </label>
                <input id="name" name="name" className="input" defaultValue={analysis.name} />
              </div>
              <div className="field">
                <label className="label" htmlFor="renewalDate">
                  Data da renovação
                </label>
                <input id="renewalDate" type="date" name="renewalDate" className="input" defaultValue={analysis.renewalDate ?? ""} />
              </div>
              <div className="field">
                <label className="label" htmlFor="termMonths">
                  Prazo pretendido
                </label>
                <TermSelect value={analysis.termMonths} />
              </div>
              <div className="field">
                <label className="label" htmlFor="proposalDue">
                  Prazo da proposta
                </label>
                <input id="proposalDue" type="date" name="proposalDue" className="input" defaultValue={analysis.proposalDue ?? ""} />
              </div>
              <div className="field">
                <label className="label" htmlFor="distributor">
                  Distribuidor
                </label>
                <input id="distributor" name="distributor" className="input" defaultValue={analysis.distributor ?? ""} />
              </div>
              <div className="field md:col-span-2">
                <label className="label" htmlFor="objective">
                  Objetivo
                </label>
                <input id="objective" name="objective" className="input" defaultValue={analysis.objective ?? ""} />
              </div>
              <div className="field md:col-span-2">
                <label className="label" htmlFor="notes">
                  Observações
                </label>
                <textarea id="notes" name="notes" className="textarea min-h-20 font-sans text-[0.9rem]" defaultValue={analysis.notes ?? ""} />
              </div>
            </div>
            <FamilyPicker selected={analysis.declaredFamilies} />
            <div className="flex justify-end">
              <SubmitButton>Salvar dados da análise</SubmitButton>
            </div>
          </form>
        </details>
      </div>

      <aside className="grid content-start gap-4">
        <section className="panel p-5">
          <h2 className="h-sub">Objetivo</h2>
          <p className="mt-1 text-[0.9rem] text-muted">{analysis.objective || "Não informado."}</p>
          {analysis.distributor && <p className="mt-2 text-[0.85rem] text-muted">Distribuidor: {analysis.distributor}</p>}
        </section>
        <section className="panel p-5">
          <h2 className="h-sub">Histórico</h2>
          <ol className="mt-2 grid gap-2.5">
            {log.map((l) => (
              <li key={l.id} className="text-[0.84rem]">
                <span className="font-bold">{l.action}</span>
                {l.detail && <span className="text-muted">: {l.detail}</span>}
                <span className="block text-[0.76rem] text-faint">
                  {l.actor}, {l.at.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
