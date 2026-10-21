import Link from "next/link";
import { loadAnalysis, reviewState, familyName } from "@/lib/load";
import { reviewAction, setStatusAction } from "@/app/actions";
import { FindingRow } from "@/components/finding";
import { EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export const metadata = { title: "Revisão" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { result, reviews, analysis } = await loadAnalysis(id);
  const { toReview, done, changed, byKey } = reviewState(result, reviews);
  const changedKeys = new Set(changed.map((f) => f.key));
  const pct = toReview.length ? Math.round((done.length / toReview.length) * 100) : 0;
  const complete = toReview.length > 0 && done.length === toReview.length && changed.length === 0;

  if (toReview.length === 0) {
    return (
      <EmptyState title="Nada para revisar ainda" action={<Link href={`/app/analyses/${id}/results`} className="btn btn-secondary">Ver resultados</Link>}>
        Conclusões críticas, de atenção e oportunidades aparecem aqui para o especialista aceitar, ajustar ou rejeitar.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="h-section">Revisão técnica</h2>
          <p className="lead mt-1">O especialista decide. Recomendações rejeitadas saem dos cenários. Downgrades só entram no cenário otimizado depois de aceitos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="TECHNICALLY_REVIEWED" />
            <SubmitButton className="btn btn-secondary">Marcar como revisada</SubmitButton>
          </form>
          <form action={setStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="APPROVED" />
            <button className="btn btn-primary" disabled={!complete} title={complete ? undefined : "Revise todas as recomendações antes de aprovar"}>
              Aprovar análise
            </button>
          </form>
        </div>
      </div>

      <div className="panel px-5 py-4">
        <div className="flex items-baseline justify-between text-[0.9rem]">
          <span>
            <strong className="num">{done.length}</strong> de <span className="num">{toReview.length}</span> recomendações revisadas
          </span>
          <span className="text-muted">Status atual: {analysis.status === "APPROVED" ? "aprovada" : "em revisão"}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-mist" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da revisão">
          <div className="h-full rounded-full bg-vivo" style={{ width: `${pct}%` }} />
        </div>
        {changed.length > 0 && <p className="mt-2 text-[0.85rem] text-warn">{changed.length} {changed.length === 1 ? "conclusão mudou" : "conclusões mudaram"} depois da revisão por causa de dados novos. Revise de novo.</p>}
      </div>

      <div className="panel">
        {toReview.map((f) => {
          const r = byKey.get(f.key);
          return (
            <div key={f.key} className="grid gap-4 border-b border-line last:border-b-0 lg:grid-cols-[1fr_340px]">
              <div>
                <p className="px-5 pt-3 text-[0.78rem] font-bold text-muted">{familyName(f.familyId)}</p>
                <FindingRow f={f} compact />
              </div>
              <form action={reviewAction} className="grid content-start gap-2.5 border-t border-line bg-mist/40 p-4 lg:border-l lg:border-t-0">
                <input type="hidden" name="analysisId" value={id} />
                <input type="hidden" name="findingKey" value={f.key} />
                {changedKeys.has(f.key) && <p className="rounded-md bg-warn-bg px-2 py-1 text-[0.8rem] text-warn">Conteúdo mudou desde a última decisão.</p>}
                <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                  <legend className="label mb-1">Decisão</legend>
                  {[
                    ["accepted", "Aceitar"],
                    ["adjusted", "Ajustar"],
                    ["rejected", "Rejeitar"],
                  ].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-1.5 text-[0.88rem]">
                      <input type="radio" name="decision" value={v} defaultChecked={(r?.decision ?? "accepted") === v} className="accent-vivo" />
                      {l}
                    </label>
                  ))}
                </fieldset>
                <label className="label" htmlFor={`c-${f.key}`}>
                  Comentário
                </label>
                <textarea id={`c-${f.key}`} name="comment" className="textarea min-h-16 font-sans text-[0.85rem]" defaultValue={r?.comment ?? ""} placeholder="Explique ajustes e rejeições" />
                <div className="flex items-end gap-2">
                  <div className="field flex-1">
                    <label className="label" htmlFor={`r-${f.key}`}>
                      Revisor
                    </label>
                    <input id={`r-${f.key}`} name="reviewer" className="input" defaultValue={r?.reviewer ?? "Especialista"} />
                  </div>
                  <SubmitButton className="btn btn-primary btn-sm">{r ? "Atualizar" : "Registrar"}</SubmitButton>
                </div>
                {r && (
                  <p className="text-[0.78rem] text-muted">
                    Decisão atual: <strong>{r.decision === "accepted" ? "aceita" : r.decision === "rejected" ? "rejeitada" : "ajustada"}</strong>
                  </p>
                )}
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
