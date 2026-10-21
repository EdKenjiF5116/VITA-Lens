import Link from "next/link";
import { loadAnalysis, familyName } from "@/lib/load";
import { savePricesAction } from "@/app/actions";
import { lookupSku } from "@/packs";
import { CHANGE } from "@/lib/labels";
import { money, termLabel } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { Scenario } from "@/domain/types";

export const metadata = { title: "Cenários" };

const CHANGE_TONE: Record<string, string> = {
  keep: "text-muted",
  adjust: "text-tblue",
  replace: "text-vivo",
  add: "text-ok",
  remove: "text-crit line-through",
};

function ScenarioTable({ s }: { s: Scenario }) {
  const groups = [...new Set(s.lines.map((l) => l.familyId))];
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Mudança</th>
            <th>SKU</th>
            <th>Descrição</th>
            <th className="right">Qtd</th>
            <th>Prazo</th>
            <th className="right">Preço unitário</th>
            <th className="right">Total</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <FragmentRows key={g} title={g === "outros" ? "Itens sem pacote de catálogo" : familyName(g)} lines={s.lines.filter((l) => l.familyId === g)} />
          ))}
        </tbody>
        {s.total && (
          <tfoot>
            <tr>
              <td colSpan={6} className="right font-bold">
                Total {s.total.complete ? "" : "parcial "}(USD, preço de lista ou informado)
              </td>
              <td className="right num font-bold">{money(s.total.amount)}</td>
              <td className="text-[0.78rem] text-muted">{s.total.complete ? "" : `${s.total.missingPrices.length} SKU${s.total.missingPrices.length > 1 ? "s" : ""} sem preço`}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function FragmentRows({ title, lines }: { title: string; lines: Scenario["lines"] }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="bg-mist/70 py-1.5 text-[0.8rem] font-bold text-muted">
          {title}
        </td>
      </tr>
      {lines.map((l, i) => (
        <tr key={`${l.sku}-${i}`}>
          <td className={`whitespace-nowrap text-[0.82rem] font-bold ${CHANGE_TONE[l.change]}`}>{CHANGE[l.change]}</td>
          <td className="sku whitespace-nowrap">{l.sku}</td>
          <td className="min-w-48 text-[0.84rem]">{l.description}</td>
          <td className="right num">{l.quantity}</td>
          <td className="whitespace-nowrap text-[0.84rem]">{termLabel(l.termMonths)}</td>
          <td className="right num whitespace-nowrap text-[0.84rem]">{l.change === "remove" ? "" : money(l.unitPrice)}</td>
          <td className="right num whitespace-nowrap">{l.change === "remove" ? "" : money(l.lineTotal)}</td>
          <td className="min-w-56 text-[0.8rem] text-muted">{l.reason}</td>
        </tr>
      ))}
    </>
  );
}

export default async function ScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { result, analysis } = await loadAnalysis(id);
  const scenarios = result.scenarios;
  if (scenarios.every((s) => s.lines.length === 0)) {
    return (
      <EmptyState title="Sem cenários ainda" action={<Link href={`/app/analyses/${id}/import`} className="btn btn-primary">Importar itens</Link>}>
        Os cenários nascem das licenças, assinaturas e contratos importados.
      </EmptyState>
    );
  }
  const skus = [...new Set(scenarios.flatMap((s) => s.lines.filter((l) => l.change !== "remove" && l.familyId !== "outros").map((l) => l.sku)))].sort();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h-section">Cenários de renovação</h2>
          <p className="lead mt-1">Quatro listas comparáveis para levar à cotação. O cenário otimizado aplica só as recomendações que o revisor não rejeitou. Downgrades entram apenas depois de aceitos.</p>
        </div>
        <a href={`/api/analyses/${id}/export?format=csv`} className="btn btn-secondary">
          Exportar cenários (CSV)
        </a>
      </div>

      <section aria-label="Comparação" className="panel grid divide-line sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
        {scenarios.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="block px-5 py-4 hover:bg-vivo-50">
            <span className="block font-bold">{s.name}</span>
            <span className="num mt-1 block text-[1.3rem] font-bold">{s.total ? money(s.total.amount) : "sem preço"}</span>
            <span className="block text-[0.8rem] text-muted">
              {s.total && !s.total.complete ? "parcial, " : ""}
              {s.lines.length} linhas, {s.risks.length} {s.risks.length === 1 ? "risco" : "riscos"}
            </span>
          </a>
        ))}
      </section>

      {scenarios.map((s) => (
        <section key={s.id} id={s.id} className="panel scroll-mt-6" aria-labelledby={`h-${s.id}`}>
          <header className="border-b border-line px-5 py-4">
            <h3 id={`h-${s.id}`} className="h-section">
              {s.name}
            </h3>
            <p className="mt-0.5 text-[0.88rem] text-muted">{s.summary}</p>
          </header>
          <ScenarioTable s={s} />
          {(s.risks.length > 0 || s.assumptions.length > 0) && (
            <div className="grid gap-4 border-t border-line px-5 py-4 md:grid-cols-2">
              {s.risks.length > 0 && (
                <div>
                  <h4 className="h-sub text-crit">Riscos</h4>
                  <ul className="mt-1 list-disc pl-5 text-[0.85rem]">
                    {s.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {s.assumptions.length > 0 && (
                <div>
                  <h4 className="h-sub">Premissas</h4>
                  <ul className="mt-1 list-disc pl-5 text-[0.85rem]">
                    {s.assumptions.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      ))}

      <details className="panel">
        <summary className="cursor-pointer px-5 py-4 font-bold">Preços de referência</summary>
        <form action={savePricesAction} className="border-t border-line p-5">
          <input type="hidden" name="analysisId" value={id} />
          <p className="hint mb-3">Preço unitário em USD para o prazo da linha. Vazio usa o preço de lista do catálogo, quando existe. O VITA Lens não calcula margem nem desconto.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skus.map((sku) => {
              const lp = lookupSku(sku)?.listPrice;
              return (
                <div key={sku} className="field">
                  <label className="sku text-[0.8rem] font-medium" htmlFor={`p-${sku}`}>
                    {sku}
                  </label>
                  <input
                    id={`p-${sku}`}
                    name={`p|${sku}`}
                    className="input"
                    inputMode="decimal"
                    defaultValue={analysis.prices?.[sku] ?? ""}
                    placeholder={lp ? `Lista: US$ ${lp.amount}${lp.per === "unit-month" ? " por mês" : ""}` : "sem preço de lista"}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <SubmitButton>Salvar preços</SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}
