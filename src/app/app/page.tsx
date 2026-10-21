import Link from "next/link";
import { listAnalyses, getAnalysis, toEngineInput } from "@/db/repo";
import { runAnalysis, needsReview } from "@/engine/run";
import { daysBetween, formatDate, todayIso } from "@/lib/dates";
import { OPEN_STATUSES } from "@/lib/labels";
import { PageHeader, SeverityTag, Stat, StatusBadge, EmptyState } from "@/components/ui";

export const metadata = { title: "Painel" };

export default async function Dashboard() {
  const today = todayIso();
  const list = await listAnalyses();
  const rows = await Promise.all(
    list.map(async (a) => {
      const b = (await getAnalysis(a.id))!;
      const r = runAnalysis(toEngineInput(b, today));
      const all = [...r.general, ...r.families.flatMap((f) => f.findings)];
      const reviewed = new Set(b.reviews.map((x) => x.findingKey));
      return {
        ...a,
        vendors: [...new Set(r.items.filter((i) => !i.ignored && i.vendorName).map((i) => i.vendorName!))],
        summary: r.summary,
        awaitingReview: all.filter((f) => needsReview(f) && !reviewed.has(f.key)).length,
      };
    }),
  );
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const in90 = open.filter((r) => r.renewalDate && daysBetween(today, r.renewalDate) <= 90);
  const sum = (k: keyof (typeof rows)[number]["summary"]) => open.reduce((s, r) => s + (r.summary[k] as number), 0);

  return (
    <>
      <PageHeader
        title="Painel de renovações"
        lead="O que vence primeiro, o que falta do cliente e o que espera revisão."
        actions={
          <Link href="/app/analyses/new" className="btn btn-primary">
            Nova análise
          </Link>
        }
      />

      <section aria-label="Indicadores" className="panel grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Stat label="Renovações nos próximos 90 dias" value={in90.length} href="/app/analyses" tone={in90.length ? "attention" : undefined} />
        <Stat label="Análises em andamento" value={open.length} href="/app/analyses" />
        <Stat label="Aguardando cliente" value={rows.filter((r) => r.status === "WAITING_CUSTOMER").length} href="/app/analyses" />
        <Stat label="Itens não reconhecidos" value={sum("unrecognized")} tone={sum("unrecognized") ? "attention" : undefined} />
        <Stat label="Atenção de ciclo de vida" value={sum("lifecycleAttention")} tone={sum("lifecycleAttention") ? "critical" : undefined} />
        <Stat label="Recomendações aguardando revisão" value={open.reduce((s, r) => s + r.awaitingReview, 0)} />
      </section>

      <section className="mt-8">
        <h2 className="h-section mb-3">Próximas renovações</h2>
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma análise ainda" action={<Link href="/app/analyses/new" className="btn btn-primary">Criar a primeira análise</Link>}>
            Crie uma análise, importe a lista de SKUs do cliente e o VITA Lens monta a primeira leitura.
          </EmptyState>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Análise</th>
                  <th>Fabricantes</th>
                  <th>Renovação</th>
                  <th>Situação</th>
                  <th className="right">Pendências</th>
                  <th>Destaques</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = r.renewalDate ? daysBetween(today, r.renewalDate) : null;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/app/analyses/${r.id}`} className="font-bold text-navy hover:text-vivo">
                          {r.name}
                        </Link>
                        <div className="text-[0.8rem] text-muted">{r.clientName}</div>
                      </td>
                      <td className="text-[0.85rem]">{r.vendors.length ? r.vendors.join(", ") : <span className="text-faint">sem itens</span>}</td>
                      <td className="whitespace-nowrap">
                        <div className="num">{formatDate(r.renewalDate)}</div>
                        {days != null && (
                          <div className={`text-[0.8rem] ${days < 0 ? "text-crit" : days <= 90 ? "text-warn" : "text-muted"}`}>
                            {days < 0 ? `venceu há ${-days} dias` : `em ${days} dias`}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="right num">{r.summary.pendingTotal || "nenhuma"}</td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {r.summary.critical > 0 && <SeverityTag severity="critical" label={`${r.summary.critical} crítico${r.summary.critical > 1 ? "s" : ""}`} />}
                          {r.summary.opportunity > 0 && <SeverityTag severity="opportunity" label={`${r.summary.opportunity} oportunidade${r.summary.opportunity > 1 ? "s" : ""}`} />}
                          {r.summary.itemCount === 0 && <span className="text-[0.82rem] text-faint">Importe os itens para começar</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
