import { ImportPanel } from "@/components/ImportPanel";
import { loadAnalysis } from "@/lib/load";
import { SOURCE_LABEL } from "@/lib/labels";

export const metadata = { title: "Importação" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { items } = await loadAnalysis(id);
  const bySource = items.reduce<Record<string, number>>((acc, i) => {
    const k = i.sourceRef?.replace(/, linha \d+$/, "") ?? SOURCE_LABEL[i.source] ?? i.source;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="h-section">Importar itens</h2>
        <p className="lead mt-1">SKUs, part numbers, contratos e equipamentos chegam de vários jeitos. Use quantas fontes precisar: cada linha guarda de onde veio.</p>
      </div>
      <ImportPanel analysisId={id} />
      {items.length > 0 && (
        <section className="panel p-5">
          <h3 className="h-sub">Já importado</h3>
          <ul className="mt-2 grid gap-1 text-[0.88rem]">
            {Object.entries(bySource).map(([k, n]) => (
              <li key={k}>
                <span className="num font-bold">{n}</span> <span className="text-muted">{n === 1 ? "linha" : "linhas"} de</span> {k}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
