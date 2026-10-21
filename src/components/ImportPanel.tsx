"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addManualItemAction, collectMerakiAction, importRowsAction, parseFileAction, type ParsedSheet } from "@/app/actions";
import { FIELDS, applyMapping, guessMapping, type FieldKey } from "@/lib/import";
import { extractFromText, type ExtractedRow } from "@/engine/extract";
import { resolveItems } from "@/engine/match";
import { MATCH, MATCH_PLURAL } from "@/lib/labels";
import type { MatchStatus } from "@/domain/types";
import { formatDate } from "@/lib/dates";
import { SubmitButton } from "./client";

type Tab = "file" | "text" | "manual" | "api";

const STATUS_TONE: Record<MatchStatus, string> = {
  recognized: "bg-ok-bg text-ok",
  partial: "bg-tblue-50 text-tblue",
  duplicate: "bg-warn-bg text-warn",
  inconsistent: "bg-crit-bg text-crit",
  unrecognized: "bg-warn-bg text-warn",
  pending: "bg-info-bg text-info",
};

function StatusChip({ s }: { s: MatchStatus }) {
  return <span className={`chip ${STATUS_TONE[s]}`}>{MATCH[s]}</span>;
}

function firstHeaderRow(rows: string[][]): number {
  const i = rows.findIndex((r) => r.filter((c) => String(c).trim() !== "").length >= 2);
  return i < 0 ? 0 : i;
}

function Done({ n, analysisId, onAgain }: { n: number; analysisId: string; onAgain: () => void }) {
  return (
    <div className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-[0.9rem]">
      <strong>{n} {n === 1 ? "item importado" : "itens importados"}.</strong>{" "}
      <Link href={`/app/analyses/${analysisId}/items`} className="link">
        Revisar itens
      </Link>{" "}
      ou{" "}
      <button type="button" className="link" onClick={onAgain}>
        importar mais
      </button>
      .
    </div>
  );
}

/* ---------- Planilha ---------- */

function FileImport({ analysisId }: { analysisId: string }) {
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const sheet = sheets[sheetIdx];
  const headers = sheet?.rows[headerRow] ?? [];
  const body = useMemo(() => (sheet ? sheet.rows.slice(headerRow + 1) : []), [sheet, headerRow]);
  const mapped = useMemo(() => (mapping.sku != null ? applyMapping(body, mapping) : []), [body, mapping]);
  const resolved = useMemo(
    () => resolveItems(mapped.map((m, i) => ({ id: String(i), rawSku: m.rawSku, quantity: m.quantity, serial: m.serial, startDate: m.startDate, endDate: m.endDate, source: "preview", sourceRef: fileName }))),
    [mapped, fileName],
  );
  const counts = resolved.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDone(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await parseFileAction(fd);
      if (res.error) return setError(res.error);
      setFileName(file.name);
      setSheets(res.sheets);
      setSheetIdx(0);
      const h = firstHeaderRow(res.sheets[0]?.rows ?? []);
      setHeaderRow(h);
      setMapping(guessMapping(res.sheets[0]?.rows[h] ?? []));
    });
  }

  function changeSheet(i: number) {
    setSheetIdx(i);
    const h = firstHeaderRow(sheets[i].rows);
    setHeaderRow(h);
    setMapping(guessMapping(sheets[i].rows[h] ?? []));
  }

  function doImport() {
    const source = fileName.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
    const rows = mapped.map((m) => ({
      rawSku: m.rawSku,
      rawDescription: m.rawDescription,
      quantity: m.quantity,
      serial: m.serial,
      startDate: m.startDate,
      endDate: m.endDate,
      contractNumber: m.contractNumber,
      unitPrice: m.unitPrice,
      source,
      sourceRef: `${fileName}, linha ${headerRow + m.row + 2}`,
    }));
    start(async () => {
      const n = await importRowsAction(analysisId, rows, fileName);
      setDone(n);
      setSheets([]);
    });
  }

  if (done != null) return <Done n={done} analysisId={analysisId} onAgain={() => setDone(null)} />;

  return (
    <div className="grid gap-5">
      <div className="field max-w-xl">
        <label htmlFor="file" className="label">
          Arquivo Excel (.xlsx) ou CSV
        </label>
        <input id="file" type="file" accept=".xlsx,.csv,.txt" className="input" onChange={(e) => onFile(e.target.files?.[0])} disabled={pending} />
        <p className="hint">Lista de SKUs, proposta anterior, relatório de contratos ou inventário exportado do portal do fabricante. Os dados ficam no seu ambiente.</p>
      </div>
      {pending && sheets.length === 0 && <p className="text-[0.9rem] text-muted">Lendo arquivo...</p>}
      {error && <p className="rounded-md bg-crit-bg px-3 py-2 text-[0.9rem] text-crit">{error}</p>}

      {sheet && (
        <>
          <div className="flex flex-wrap gap-4">
            {sheets.length > 1 && (
              <div className="field">
                <label className="label" htmlFor="sheet">
                  Aba
                </label>
                <select id="sheet" className="select" value={sheetIdx} onChange={(e) => changeSheet(Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field w-40">
              <label className="label" htmlFor="header">
                Linha do cabeçalho
              </label>
              <input
                id="header"
                type="number"
                min={1}
                className="input"
                value={headerRow + 1}
                onChange={(e) => {
                  const h = Math.max(0, Number(e.target.value) - 1);
                  setHeaderRow(h);
                  setMapping(guessMapping(sheet.rows[h] ?? []));
                }}
              />
            </div>
          </div>

          <fieldset>
            <legend className="h-sub mb-2">Mapeamento das colunas</legend>
            <p className="hint mb-3">Sugerido pelo nome das colunas. Confira antes de importar. Sem coluna de quantidade, cada linha conta como 1 (inventário por número de série).</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FIELDS.map((f) => (
                <div key={f.key} className="field">
                  <label className="label" htmlFor={`map-${f.key}`}>
                    {f.label}
                    {f.required && <span className="text-crit"> *</span>}
                  </label>
                  <select
                    id={`map-${f.key}`}
                    className="select"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })}
                  >
                    <option value="">Não usar</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {String.fromCharCode(65 + (i % 26))}: {h || "(sem título)"}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>

          {mapping.sku == null ? (
            <p className="text-[0.9rem] text-warn">Escolha a coluna de SKU para ver a prévia.</p>
          ) : (
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="h-sub mr-2">Prévia: {mapped.length} linhas</h3>
                {Object.entries(counts).map(([s, n]) => (
                  <span key={s} className={`chip ${STATUS_TONE[s as MatchStatus]}`}>
                    {n} {n === 1 ? MATCH[s as MatchStatus].toLowerCase() : MATCH_PLURAL[s as MatchStatus]}
                  </span>
                ))}
              </div>
              <div className="panel max-h-96 overflow-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>SKU</th>
                      <th>Descrição</th>
                      <th className="right">Qtd</th>
                      <th>Vencimento</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.slice(0, 200).map((r, i) => (
                      <tr key={i}>
                        <td className="num text-muted">{headerRow + mapped[i].row + 2}</td>
                        <td className="sku whitespace-nowrap">{r.effectiveSku || <span className="text-crit">vazio</span>}</td>
                        <td className="max-w-72 truncate text-[0.82rem] text-muted">{mapped[i].rawDescription}</td>
                        <td className="right num">{Number.isFinite(r.quantity) ? r.quantity : "?"}</td>
                        <td className="whitespace-nowrap text-[0.82rem]">{mapped[i].endDate ? formatDate(mapped[i].endDate) : ""}</td>
                        <td>
                          <StatusChip s={r.status} />
                          {r.statusNote && <div className="mt-0.5 text-[0.75rem] text-muted">{r.statusNote}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint mt-2">Itens não reconhecidos também são importados. Eles ficam na fila de revisão da etapa de itens.</p>
              <div className="mt-4 flex justify-end">
                <button type="button" className="btn btn-primary" disabled={pending || mapped.length === 0} onClick={doImport}>
                  {pending ? "Importando..." : `Importar ${mapped.length} linhas`}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Texto colado ---------- */

const SAMPLE = `Bom dia! Segue o que temos para renovar:
- 120 x LIC-MR-ADV-3Y, vencimento 19/01/2027
- FC-10-0060F-950-02-12 qtd 12
- DUO-ADVANTAGE 500 licenças`;

function TextImport({ analysisId }: { analysisId: string }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<(ExtractedRow & { include: boolean })[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  if (done != null) return <Done n={done} analysisId={analysisId} onAgain={() => { setDone(null); setRows(null); setText(""); }} />;

  return (
    <div className="grid gap-4">
      <div className="field">
        <label htmlFor="paste" className="label">
          Cole o texto do e-mail, da proposta ou do PDF
        </label>
        <textarea id="paste" className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
        <p className="hint">O VITA Lens procura part numbers, quantidades e datas linha a linha. Você confere tudo antes de importar.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => setRows(extractFromText(text || SAMPLE).map((r) => ({ ...r, include: true })))}>
          {text ? "Extrair itens" : "Testar com o exemplo"}
        </button>
      </div>
      {rows && rows.length === 0 && <p className="text-[0.9rem] text-warn">Nenhum SKU encontrado no texto.</p>}
      {rows && rows.length > 0 && (
        <>
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Importar</th>
                  <th>Linha</th>
                  <th>SKU</th>
                  <th className="right">Qtd</th>
                  <th>Vencimento</th>
                  <th>Catálogo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Importar ${r.rawSku}`}
                        checked={r.include}
                        className="accent-vivo"
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                      />
                    </td>
                    <td className="num text-muted">{r.line}</td>
                    <td className="sku whitespace-nowrap">{r.rawSku}</td>
                    <td className="right">
                      <input
                        aria-label={`Quantidade de ${r.rawSku}`}
                        className="input w-20 text-right"
                        value={r.quantity}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x)))}
                      />
                    </td>
                    <td className="text-[0.82rem]">{r.endDate ? formatDate(r.endDate) : ""}</td>
                    <td>{r.known ? <StatusChip s="recognized" /> : <StatusChip s="unrecognized" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !rows.some((r) => r.include)}
              onClick={() =>
                start(async () => {
                  const sel = rows.filter((r) => r.include);
                  const n = await importRowsAction(
                    analysisId,
                    sel.map((r) => ({ rawSku: r.rawSku, rawDescription: r.rawDescription, quantity: r.quantity, endDate: r.endDate, source: "paste", sourceRef: `Texto colado, linha ${r.line}` })),
                    "texto colado",
                  );
                  setDone(n);
                })
              }
            >
              {pending ? "Importando..." : `Importar ${rows.filter((r) => r.include).length} itens`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Manual ---------- */

function ManualImport({ analysisId }: { analysisId: string }) {
  return (
    <form action={addManualItemAction} className="grid gap-4">
      <input type="hidden" name="analysisId" value={analysisId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="field">
          <label className="label" htmlFor="m-sku">
            SKU ou part number <span className="text-crit">*</span>
          </label>
          <input id="m-sku" name="sku" className="input sku" required placeholder="LIC-ENT-3YR" />
        </div>
        <div className="field">
          <label className="label" htmlFor="m-qty">
            Quantidade
          </label>
          <input id="m-qty" name="quantity" className="input" inputMode="decimal" defaultValue="1" />
        </div>
        <div className="field">
          <label className="label" htmlFor="m-end">
            Vencimento
          </label>
          <input id="m-end" name="endDate" type="date" className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="m-desc">
            Descrição
          </label>
          <input id="m-desc" name="description" className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="m-serial">
            Número de série
          </label>
          <input id="m-serial" name="serial" className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="m-contract">
            Contrato
          </label>
          <input id="m-contract" name="contractNumber" className="input" />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Adicionando...">Adicionar item</SubmitButton>
      </div>
    </form>
  );
}

/* ---------- Coleta por API ---------- */

function ApiImport({ analysisId }: { analysisId: string }) {
  const [mode, setMode] = useState<"demo" | "api">("demo");
  const [apiKey, setApiKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [result, setResult] = useState<{ ok: boolean; summary: string[]; error?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4">
      <div className="max-w-2xl text-[0.9rem] text-muted">
        <p>
          Lê o inventário de access points, quem está em rede ou guardado, status, datas de fim de venda e suporte, o limite de licenças co-term e se o Adaptive Policy está ativo. Tudo entra como evidência <strong className="text-tblue">coletada</strong>, que vale mais que dado declarado.
        </p>
        <p className="mt-2">Outros fabricantes entram pelo mesmo caminho: cada pacote pode ter o seu conector.</p>
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Modo de coleta</legend>
        <label className="flex items-center gap-2 text-[0.9rem]">
          <input type="radio" name="mode" className="accent-vivo" checked={mode === "demo"} onChange={() => setMode("demo")} /> Dados de demonstração
        </label>
        <label className="flex items-center gap-2 text-[0.9rem]">
          <input type="radio" name="mode" className="accent-vivo" checked={mode === "api"} onChange={() => setMode("api")} /> Organização real (Meraki Dashboard API)
        </label>
      </fieldset>
      {mode === "api" && (
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="apikey">
              Chave de API (somente leitura)
            </label>
            <input id="apikey" type="password" autoComplete="off" className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <p className="hint">Usada só nesta coleta. Não é gravada.</p>
          </div>
          <div className="field">
            <label className="label" htmlFor="orgid">
              ID da organização
            </label>
            <input id="orgid" className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || (mode === "api" && (!apiKey || !orgId))}
          onClick={() => start(async () => setResult(await collectMerakiAction(analysisId, { mode, apiKey, orgId })))}
        >
          {pending ? "Coletando..." : "Coletar dados do Meraki"}
        </button>
      </div>
      {result && !result.ok && <p className="rounded-md bg-crit-bg px-3 py-2 text-[0.9rem] text-crit">Coleta falhou: {result.error}</p>}
      {result?.ok && (
        <div className="rounded-lg border border-tblue/30 bg-tblue-50 px-4 py-3 text-[0.9rem]">
          <p className="font-bold">Coleta concluída</p>
          <ul className="mt-1 list-disc pl-5">
            {result.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="mt-2">
            <Link href={`/app/analyses/${analysisId}/results`} className="link">
              Ver resultados atualizados
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export function ImportPanel({ analysisId }: { analysisId: string }) {
  const [tab, setTab] = useState<Tab>("file");
  const tabs: { id: Tab; label: string }[] = [
    { id: "file", label: "Planilha" },
    { id: "text", label: "Texto colado" },
    { id: "manual", label: "Item manual" },
    { id: "api", label: "Coletar via API" },
  ];
  return (
    <div className="panel">
      <div role="tablist" aria-label="Forma de importação" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`rounded-t-md px-4 py-2 text-[0.9rem] font-bold ${tab === t.id ? "bg-vivo-50 text-vivo" : "text-muted hover:text-navy"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-5">
        {tab === "file" && <FileImport analysisId={analysisId} />}
        {tab === "text" && <TextImport analysisId={analysisId} />}
        {tab === "manual" && <ManualImport analysisId={analysisId} />}
        {tab === "api" && <ApiImport analysisId={analysisId} />}
      </div>
    </div>
  );
}
