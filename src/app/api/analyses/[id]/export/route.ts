import { getAnalysis, toEngineInput, audit } from "@/db/repo";
import { runAnalysis } from "@/engine/run";
import { getPack } from "@/packs";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getAnalysis(id);
  if (!bundle) return new Response("Análise não encontrada", { status: 404 });
  const result = runAnalysis(toEngineInput(bundle));
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const slug = bundle.analysis.name.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

  if (format === "json") {
    await audit(id, "Exportação", "JSON");
    const body = JSON.stringify({ analysis: bundle.analysis, client: bundle.client, reviews: bundle.reviews, result }, null, 2);
    return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="vita-lens-${slug}.json"` } });
  }

  // CSV com ponto e vírgula: abre direto no Excel em português.
  const header = ["Cenário", "Família", "Mudança", "SKU", "Descrição", "Quantidade", "Prazo (meses)", "Preço unitário (USD)", "Total (USD)", "Motivo"];
  const rows = result.scenarios.flatMap((s) =>
    s.lines.map((l) => [s.name, l.familyId === "outros" ? "Sem pacote" : getPack(l.familyId)?.name ?? l.familyId, l.change, l.sku, l.description, l.quantity, l.termMonths ?? "", l.unitPrice ?? "", l.lineTotal ?? "", l.reason]),
  );
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  await audit(id, "Exportação", "Cenários em CSV");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="vita-lens-${slug}-cenarios.csv"` } });
}
