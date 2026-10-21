import { listClients } from "@/db/repo";
import { createAnalysisAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { FamilyPicker, TermSelect } from "@/components/forms";

export const metadata = { title: "Nova análise" };

export default async function NewAnalysis({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const clients = await listClients();
  return (
    <>
      <PageHeader title="Nova análise" lead="Comece pelo básico. Itens, utilização e conclusões vêm nas próximas etapas." />
      <form action={createAnalysisAction} className="panel grid gap-5 p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="clientId">
              Cliente
            </label>
            <select id="clientId" name="clientId" className="select" defaultValue={client ?? clients[0]?.id ?? "__new"}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new">Novo cliente</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="newClient">
              Novo cliente (razão social)
            </label>
            <input id="newClient" name="newClient" className="input" placeholder="Preencha só se escolheu Novo cliente" />
          </div>
          <div className="field md:col-span-2">
            <label className="label" htmlFor="name">
              Nome da análise
            </label>
            <input id="name" name="name" className="input" required placeholder="Ex.: Renovação firewall das filiais 2027" />
          </div>
          <div className="field">
            <label className="label" htmlFor="renewalDate">
              Data esperada da renovação
            </label>
            <input id="renewalDate" name="renewalDate" type="date" className="input" />
          </div>
          <div className="field">
            <label className="label" htmlFor="termMonths">
              Prazo pretendido
            </label>
            <TermSelect />
          </div>
          <div className="field">
            <label className="label" htmlFor="proposalDue">
              Prazo para enviar a proposta
            </label>
            <input id="proposalDue" name="proposalDue" type="date" className="input" />
          </div>
          <div className="field">
            <label className="label" htmlFor="distributor">
              Distribuidor
            </label>
            <input id="distributor" name="distributor" className="input" />
          </div>
          <div className="field md:col-span-2">
            <label className="label" htmlFor="objective">
              Objetivo da análise
            </label>
            <input id="objective" name="objective" className="input" placeholder="Ex.: renovar e avaliar refresh dos equipamentos antigos" />
          </div>
        </div>
        <FamilyPicker />
        <div className="flex justify-end">
          <SubmitButton pendingText="Criando...">Criar e importar itens</SubmitButton>
        </div>
      </form>
    </>
  );
}
