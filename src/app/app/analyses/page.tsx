import Link from "next/link";
import { listAnalyses } from "@/db/repo";
import { daysBetween, formatDate, todayIso } from "@/lib/dates";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { getPack } from "@/packs";

export const metadata = { title: "Análises" };

export default async function AnalysesPage() {
  const list = await listAnalyses();
  const today = todayIso();
  return (
    <>
      <PageHeader
        title="Análises de renovação"
        lead="Cada análise reúne os itens de um cliente, as respostas sobre o uso, as conclusões do motor e a revisão."
        actions={
          <Link href="/app/analyses/new" className="btn btn-primary">
            Nova análise
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="Nenhuma análise" action={<Link href="/app/analyses/new" className="btn btn-primary">Nova análise</Link>} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Análise</th>
                <th>Cliente</th>
                <th>Famílias esperadas</th>
                <th>Renovação</th>
                <th className="right">Prazo</th>
                <th className="right">Itens</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const days = a.renewalDate ? daysBetween(today, a.renewalDate) : null;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link className="font-bold hover:text-vivo" href={`/app/analyses/${a.id}`}>
                        {a.name}
                      </Link>
                    </td>
                    <td>{a.clientName}</td>
                    <td className="text-[0.85rem] text-muted">{a.declaredFamilies.map((f) => getPack(f)?.name ?? f).join(", ") || "detectadas na importação"}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(a.renewalDate)}
                      {days != null && <span className={`ml-1.5 text-[0.8rem] ${days <= 90 ? "text-warn" : "text-muted"}`}>({days} dias)</span>}
                    </td>
                    <td className="right num">{a.termMonths} meses</td>
                    <td className="right num">{a.itemCount}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
