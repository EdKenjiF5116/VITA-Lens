import Link from "next/link";
import { loadAnalysis, familyName } from "@/lib/load";
import { itemAction } from "@/app/actions";
import { CATEGORY, MATCH, SOURCE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import type { MatchStatus, ResolvedItem } from "@/domain/types";

export const metadata = { title: "Itens" };

const TONE: Record<MatchStatus, string> = {
  recognized: "bg-ok-bg text-ok",
  partial: "bg-tblue-50 text-tblue",
  duplicate: "bg-warn-bg text-warn",
  inconsistent: "bg-crit-bg text-crit",
  unrecognized: "bg-warn-bg text-warn",
  pending: "bg-info-bg text-info",
};

const FILTERS: { id: string; label: string; test: (i: ResolvedItem) => boolean }[] = [
  { id: "all", label: "Todos", test: (i) => !i.ignored },
  { id: "review", label: "Para revisar", test: (i) => !i.ignored && i.status !== "recognized" },
  { id: "recognized", label: "Reconhecidos", test: (i) => !i.ignored && i.status === "recognized" },
  { id: "ignored", label: "Ignorados", test: (i) => !!i.ignored },
];

export default async function ItemsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> }) {
  const { id } = await params;
  const { f = "all" } = await searchParams;
  const { result } = await loadAnalysis(id);
  const filter = FILTERS.find((x) => x.id === f) ?? FILTERS[0];
  const rows = result.items.filter(filter.test);

  if (result.items.length === 0) {
    return (
      <EmptyState title="Nenhum item importado" action={<Link href={`/app/analyses/${id}/import`} className="btn btn-primary">Importar itens</Link>}>
        Importe a lista de SKUs, contratos ou equipamentos para o VITA Lens reconhecer cada produto.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h-section">Produtos identificados</h2>
          <p className="lead mt-1">Cada linha recebe um estado. Itens desconhecidos não são descartados: corrija o SKU, ignore ou deixe para revisão manual.</p>
        </div>
        <nav aria-label="Filtro" className="flex gap-1 rounded-lg border border-line bg-white p-1">
          {FILTERS.map((x) => (
            <Link
              key={x.id}
              href={`?f=${x.id}`}
              aria-current={x.id === filter.id ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 text-[0.84rem] font-bold ${x.id === filter.id ? "bg-vivo text-white" : "text-muted hover:text-navy"}`}
            >
              {x.label} <span className="num font-normal opacity-80">{result.items.filter(x.test).length}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Categoria</th>
              <th className="right">Qtd</th>
              <th>Vencimento</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={i.ignored ? "opacity-60" : ""}>
                <td className="whitespace-nowrap">
                  <span className="sku">{i.effectiveSku}</span>
                  {i.overrideSku && <div className="text-[0.75rem] text-muted">corrigido de {i.rawSku}</div>}
                  {i.serial && <div className="sku text-[0.75rem] text-faint">S/N {i.serial}</div>}
                  <div className="mt-1 text-[0.74rem] text-faint" title={i.sourceRef ?? undefined}>
                    {SOURCE_LABEL[i.source] ?? i.source}
                    {i.sourceRef ? `: ${i.sourceRef.replace(/^.*?, /, "")}` : ""}
                  </div>
                </td>
                <td className="min-w-56">
                  <div className="text-[0.86rem]">{i.record?.description ?? i.rawDescription ?? <span className="text-faint">sem descrição</span>}</div>
                  <div className="text-[0.76rem] text-muted">
                    {i.vendorName ?? "Fabricante não identificado"}
                    {i.familyId ? `, ${familyName(i.familyId)}` : ""}
                  </div>
                </td>
                <td className="text-[0.84rem]">{CATEGORY[i.category]}</td>
                <td className="right num">{Number.isFinite(i.quantity) ? i.quantity : "?"}</td>
                <td className="whitespace-nowrap text-[0.84rem]">{i.endDate ? formatDate(i.endDate) : <span className="text-faint">sem data</span>}</td>
                <td className="min-w-44">
                  <span className={`chip ${TONE[i.status]}`}>{MATCH[i.status]}</span>
                  {i.statusNote && <div className={`mt-1 text-[0.76rem] ${i.status === "recognized" ? "text-faint" : "text-muted"}`}>{i.statusNote}</div>}
                </td>
                <td className="whitespace-nowrap">
                  <details className="relative">
                    <summary className="btn btn-quiet btn-sm list-none">Ajustar</summary>
                    <div className="absolute right-0 z-10 mt-1 grid w-72 gap-3 rounded-lg border border-line bg-white p-3 shadow-lg">
                      <form action={itemAction} className="grid gap-2">
                        <input type="hidden" name="analysisId" value={id} />
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="op" value="override" />
                        <label className="label" htmlFor={`ov-${i.id}`}>
                          Corrigir SKU
                        </label>
                        <input id={`ov-${i.id}`} name="overrideSku" className="input sku" defaultValue={i.overrideSku ?? ""} placeholder={i.rawSku} />
                        <button className="btn btn-secondary btn-sm">Aplicar correção</button>
                      </form>
                      <form action={itemAction} className="grid gap-2">
                        <input type="hidden" name="analysisId" value={id} />
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="op" value="qty" />
                        <label className="label" htmlFor={`q-${i.id}`}>
                          Quantidade
                        </label>
                        <div className="flex gap-2">
                          <input id={`q-${i.id}`} name="quantity" className="input" defaultValue={Number.isFinite(i.quantity) ? i.quantity : ""} />
                          <button className="btn btn-secondary btn-sm">Salvar</button>
                        </div>
                      </form>
                      <div className="flex gap-2 border-t border-line pt-3">
                        <form action={itemAction}>
                          <input type="hidden" name="analysisId" value={id} />
                          <input type="hidden" name="itemId" value={i.id} />
                          <input type="hidden" name="op" value={i.ignored ? "restore" : "ignore"} />
                          <button className="btn btn-secondary btn-sm">{i.ignored ? "Voltar para a análise" : "Ignorar na análise"}</button>
                        </form>
                        <form action={itemAction}>
                          <input type="hidden" name="analysisId" value={id} />
                          <input type="hidden" name="itemId" value={i.id} />
                          <input type="hidden" name="op" value="delete" />
                          <button className="btn btn-quiet btn-sm text-crit">Excluir</button>
                        </form>
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-6 text-center text-[0.9rem] text-muted">Nenhum item neste filtro.</p>}
      </div>
    </div>
  );
}
