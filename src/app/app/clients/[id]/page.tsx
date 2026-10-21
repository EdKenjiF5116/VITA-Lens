import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/db/repo";
import { formatDate } from "@/lib/dates";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClient(id);
  if (!data) notFound();
  const { client, analyses } = data;
  const facts: [string, string | number | null][] = [
    ["Nome fantasia", client.tradeName],
    ["CNPJ", client.cnpj],
    ["Setor", client.sector],
    ["Unidades", client.sites],
    ["Região", client.region],
    ["Criticidade", client.criticality],
    ["Responsável comercial", client.salesOwner],
    ["Responsável técnico", client.technicalOwner],
    ["Contato", client.contact],
  ];
  return (
    <>
      <PageHeader
        title={client.name}
        actions={
          <Link href={`/app/analyses/new?client=${id}`} className="btn btn-primary">
            Nova análise para este cliente
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section>
          <h2 className="h-section mb-3">Análises</h2>
          {analyses.length === 0 ? (
            <EmptyState title="Nenhuma análise para este cliente" />
          ) : (
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Análise</th>
                    <th>Renovação</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/app/analyses/${a.id}`} className="font-bold hover:text-vivo">
                          {a.name}
                        </Link>
                      </td>
                      <td>{formatDate(a.renewalDate)}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="panel p-5">
          <h2 className="h-sub mb-2">Cadastro</h2>
          <dl className="grid gap-2 text-[0.88rem]">
            {facts
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[0.78rem] text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
