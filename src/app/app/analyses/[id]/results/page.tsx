import Link from "next/link";
import { loadAnalysis, reviewState } from "@/lib/load";
import { getPack } from "@/packs";
import { DIMENSION, DIMENSION_ORDER } from "@/lib/labels";
import { EmptyState, EvidenceLegend, PackStatus, SeverityTag } from "@/components/ui";
import { FindingRow } from "@/components/finding";
import type { Finding } from "@/domain/types";
import { needsReview } from "@/engine/run";

export const metadata = { title: "Resultados" };

function Group({ findings, byKey }: { findings: Finding[]; byKey: Map<string, { decision: string; comment: string | null; reviewer: string | null }> }) {
  return (
    <>
      {DIMENSION_ORDER.map((d) => {
        const list = findings.filter((f) => f.dimension === d);
        if (!list.length) return null;
        return (
          <div key={d}>
            <h4 className="border-b border-line bg-mist/60 px-5 py-2 text-[0.85rem] font-bold text-muted">{DIMENSION[d]}</h4>
            {list.map((f) => (
              <FindingRow key={f.key} f={f} review={byKey.get(f.key) ?? undefined} />
            ))}
          </div>
        );
      })}
    </>
  );
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { result, reviews } = await loadAnalysis(id);
  const { byKey } = reviewState(result, reviews);
  const s = result.summary;

  if (s.itemCount === 0 && result.families.length === 0) {
    return (
      <EmptyState title="Ainda não há o que analisar" action={<Link href={`/app/analyses/${id}/import`} className="btn btn-primary">Importar itens</Link>}>
        O motor roda assim que existirem itens. Cada conclusão vem com regra, evidência, fonte e nível de confiança.
      </EmptyState>
    );
  }

  const pending = result.families.flatMap((f) => f.pending);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid content-start gap-6">
        <div>
          <h2 className="h-section">Análise preliminar</h2>
          <p className="lead mt-1">
            Conclusões do motor de regras, por família e por dimensão. Nada aqui é recomendação final: cada item passa pela revisão de um especialista.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.critical > 0 && <SeverityTag severity="critical" label={`${s.critical} crítico${s.critical > 1 ? "s" : ""}`} />}
            {s.attention > 0 && <SeverityTag severity="attention" label={`${s.attention} de atenção`} />}
            {s.opportunity > 0 && <SeverityTag severity="opportunity" label={`${s.opportunity} oportunidade${s.opportunity > 1 ? "s" : ""}`} />}
          </div>
        </div>

        {result.general.length > 0 && (
          <section className="panel" aria-labelledby="h-general">
            <h3 id="h-general" className="border-b border-line px-5 py-3 h-sub">
              Dados da análise
            </h3>
            {result.general.map((f) => (
              <FindingRow key={f.key} f={f} review={byKey.get(f.key) ?? undefined} />
            ))}
          </section>
        )}

        {result.families.map((fam) => {
          const pack = getPack(fam.familyId)!;
          return (
            <section key={fam.familyId} className="panel" aria-labelledby={`h-${fam.familyId}`}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <h3 id={`h-${fam.familyId}`} className="h-section">
                  {pack.name}
                </h3>
                <PackStatus status={pack.status} />
              </header>
              {fam.findings.length === 0 && <p className="px-5 py-4 text-[0.9rem] text-muted">Sem conclusões ainda. Importe itens desta família ou responda as perguntas de utilização.</p>}
              <Group findings={fam.findings.filter(needsReview)} byKey={byKey} />
              {fam.findings.some((f) => !needsReview(f)) && (
                <details className="border-t border-line">
                  <summary className="cursor-pointer px-5 py-3 text-[0.88rem] font-bold text-muted hover:text-navy">
                    {fam.findings.filter((f) => !needsReview(f)).length} conclusões sem ação: adequadas ou informativas
                  </summary>
                  <Group findings={fam.findings.filter((f) => !needsReview(f))} byKey={byKey} />
                </details>
              )}
            </section>
          );
        })}
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-6">
        <section className="panel p-5">
          <h3 className="h-sub">Informações que faltam</h3>
          {pending.length === 0 ? (
            <p className="mt-1 text-[0.88rem] text-muted">Nenhuma pendência de alto impacto.</p>
          ) : (
            <ul className="mt-2 grid gap-2.5">
              {pending.map((p) => (
                <li key={p.answerKey} className="text-[0.85rem]">
                  <Link className="link font-bold" href={`/app/analyses/${id}/discovery#${p.answerKey}`}>
                    {p.label}
                  </Link>
                  <span className="block text-[0.78rem] text-muted">
                    {getPack(p.familyId)?.name}. Impacto {p.impact === "high" ? "alto" : p.impact === "medium" ? "médio" : "baixo"}.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel p-5">
          <h3 className="h-sub">Como ler a evidência</h3>
          <div className="mt-2">
            <EvidenceLegend />
          </div>
          <p className="hint mt-2">A confiança de cada conclusão sai da evidência mais fraca que ela usa e da situação do catálogo. A IA não define confiança.</p>
        </section>
      </aside>
    </div>
  );
}
