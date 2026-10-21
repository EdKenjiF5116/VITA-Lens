import { createClientAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export const metadata = { title: "Novo cliente" };

const fields: { name: string; label: string; type?: string; placeholder?: string; required?: boolean }[] = [
  { name: "name", label: "Razão social", required: true },
  { name: "tradeName", label: "Nome fantasia" },
  { name: "cnpj", label: "CNPJ (opcional)" },
  { name: "sector", label: "Setor", placeholder: "Ex.: varejo, saúde, indústria" },
  { name: "sites", label: "Quantidade de unidades", type: "number" },
  { name: "region", label: "País e região" },
  { name: "salesOwner", label: "Responsável comercial" },
  { name: "technicalOwner", label: "Responsável técnico" },
  { name: "contact", label: "Contato no cliente" },
];

export default function NewClient() {
  return (
    <>
      <PageHeader title="Novo cliente" />
      <form action={createClientAction} className="panel grid gap-4 p-5 md:grid-cols-2 md:p-6">
        {fields.map((f) => (
          <div key={f.name} className="field">
            <label className="label" htmlFor={f.name}>
              {f.label}
            </label>
            <input id={f.name} name={f.name} type={f.type ?? "text"} className="input" placeholder={f.placeholder} required={f.required} />
          </div>
        ))}
        <div className="field">
          <label className="label" htmlFor="criticality">
            Criticidade do ambiente
          </label>
          <select id="criticality" name="criticality" className="select" defaultValue="Média">
            <option>Baixa</option>
            <option>Média</option>
            <option>Alta</option>
          </select>
        </div>
        <div className="field md:col-span-2">
          <label className="label" htmlFor="notes">
            Observações
          </label>
          <textarea id="notes" name="notes" className="textarea min-h-20 font-sans text-[0.9rem]" />
        </div>
        <div className="flex justify-end md:col-span-2">
          <SubmitButton>Cadastrar cliente</SubmitButton>
        </div>
      </form>
    </>
  );
}
