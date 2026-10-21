import Link from "next/link";
import { listClients } from "@/db/repo";
import { PageHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const clients = await listClients();
  return (
    <>
      <PageHeader
        title="Clientes"
        lead="O cadastro serve para organizar as análises e guardar o histórico. Não é um CRM."
        actions={
          <Link href="/app/clients/new" className="btn btn-primary">
            Novo cliente
          </Link>
        }
      />
      {clients.length === 0 ? (
        <EmptyState title="Nenhum cliente" action={<Link href="/app/clients/new" className="btn btn-primary">Cadastrar cliente</Link>} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Setor</th>
                <th>Região</th>
                <th className="right">Unidades</th>
                <th>Criticidade</th>
                <th className="right">Análises</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/app/clients/${c.id}`} className="font-bold hover:text-vivo">
                      {c.name}
                    </Link>
                    {c.tradeName && <div className="text-[0.8rem] text-muted">{c.tradeName}</div>}
                  </td>
                  <td>{c.sector ?? ""}</td>
                  <td>{c.region ?? ""}</td>
                  <td className="right num">{c.sites ?? ""}</td>
                  <td>{c.criticality ?? ""}</td>
                  <td className="right num">{c.analyses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
