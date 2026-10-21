import Link from "next/link";
import { loadAnalysis, reviewState } from "@/lib/load";
import { daysBetween, formatDate, todayIso } from "@/lib/dates";
import { STATUS } from "@/lib/labels";
import { StatusBadge } from "@/components/ui";
import { StepLink, SubmitButton } from "@/components/client";
import { setStatusAction } from "@/app/actions";
import { getPack } from "@/packs";

function Count({ n, tone }: { n: number; tone: "crit" | "warn" | "vivo" }) {
  if (!n) return null;
  const cls = tone === "crit" ? "bg-crit-bg text-crit" : tone === "warn" ? "bg-warn-bg text-warn" : "bg-vivo-50 text-vivo";
  return <span className={`num rounded-full px-1.5 text-[0.72rem] font-bold ${cls}`}>{n}</span>;
}

export default async function AnalysisLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { analysis, client, result, reviews } = await loadAnalysis(id);
  const days = analysis.renewalDate ? daysBetween(todayIso(), analysis.renewalDate) : null;
  const rv = reviewState(result, reviews);
  const families = result.families.map((f) => getPack(f.familyId)!).filter(Boolean);
  const base = `/app/analyses/${id}`;

  return (
    <div>
      <header className="no-print mb-5">
        <p className="text-[0.85rem] text-muted">
          <Link href={`/app/clients/${client.id}`} className="hover:text-vivo">
            {client.name}
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="h-page">{analysis.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.88rem] text-muted">
              <StatusBadge status={analysis.status} />
              <span>
                Renovação em <strong className="text-navy">{formatDate(analysis.renewalDate)}</strong>
                {days != null && <span className={days <= 90 ? " text-warn" : ""}>{days < 0 ? `, vencida há ${-days} dias` : `, faltam ${days} dias`}</span>}
              </span>
              <span>Prazo pretendido: {analysis.termMonths} meses</span>
              {families.length > 0 && <span>{families.map((p) => p.name).join(", ")}</span>}
            </div>
          </div>
          <form action={setStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <label htmlFor="status" className="sr-only">
              Status da análise
            </label>
            <select id="status" name="status" defaultValue={analysis.status} className="select w-auto">
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <SubmitButton className="btn btn-secondary btn-sm">Alterar status</SubmitButton>
          </form>
        </div>
        <nav aria-label="Etapas da análise" className="mt-5 flex gap-5 overflow-x-auto border-b border-line">
          <StepLink href={base} label="Resumo" exact />
          <StepLink href={`${base}/import`} n={1} label="Importação" />
          <StepLink href={`${base}/items`} n={2} label="Itens" badge={<Count n={result.summary.unrecognized} tone="warn" />} />
          <StepLink href={`${base}/discovery`} n={3} label="Utilização" badge={<Count n={result.summary.pendingHigh} tone="warn" />} />
          <StepLink href={`${base}/results`} n={4} label="Resultados" badge={<Count n={result.summary.critical} tone="crit" />} />
          <StepLink href={`${base}/scenarios`} n={5} label="Cenários" />
          <StepLink href={`${base}/review`} n={6} label="Revisão" badge={<Count n={rv.toReview.length - rv.done.length} tone="vivo" />} />
          <StepLink href={`${base}/report`} n={7} label="Relatório" />
        </nav>
      </header>
      {children}
    </div>
  );
}
