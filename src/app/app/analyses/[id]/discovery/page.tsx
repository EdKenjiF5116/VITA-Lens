import Link from "next/link";
import { loadAnalysis } from "@/lib/load";
import { saveAnswersAction } from "@/app/actions";
import { getPack } from "@/packs";
import { Q } from "@/packs/common";
import { answerKey, sumQty } from "@/engine/helpers";
import { modelsInScope } from "@/engine/rules/lifecycle";
import { buildContext, parseList } from "@/engine/context";
import { METRIC, ORIGIN } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { EmptyState, EvidenceLegend, EvidenceMark, PackStatus } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { Answer, EvidenceOrigin, FamilyPack, Question } from "@/domain/types";

export const metadata = { title: "Utilização" };

const ORIGINS: EvidenceOrigin[] = ["declared", "documented", "collected", "validated"];
const MODEL_KEYS = [Q.unitsInstalled, Q.unitsActive, Q.unitsHaSecondary, Q.unitsSpare] as string[];

function OriginSelect({ name, value }: { name: string; value?: EvidenceOrigin }) {
  return (
    <select name={name} defaultValue={value ?? "declared"} className="select w-auto py-1 text-[0.8rem]" aria-label="Origem da informação">
      {ORIGINS.map((o) => (
        <option key={o} value={o}>
          {ORIGIN[o]}
        </option>
      ))}
    </select>
  );
}

function featureTierLabel(pack: FamilyPack, tiers: string[]) {
  const names = [...pack.tiers, ...(pack.addons ?? [])].filter((t) => tiers.includes(t.id)).map((t) => t.name);
  if (pack.tiers.length && names.length === pack.tiers.length) return "todos os níveis";
  return names.join(", ");
}

function QuestionField({ pack, q, a, model, suggestion }: { pack: FamilyPack; q: Question; a?: Answer; model?: string; suggestion?: string }) {
  const key = `${pack.id}|${model ?? ""}|${q.key}`;
  const values: string[] = q.type === "multiselect" ? parseList(a?.value) ?? [] : [];
  return (
    <div className="grid gap-2 border-b border-line py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-6" id={answerKey(pack.id, q.key, model)}>
      <div>
        <div className="flex items-start gap-2">
          {a && (
            <span className="mt-1">
              <EvidenceMark origin={a.origin} />
            </span>
          )}
          <label className="text-[0.92rem] font-bold" htmlFor={q.type === "multiselect" ? undefined : `f-${key}`}>
            {q.label}
          </label>
        </div>
        {q.help && <p className="hint mt-1">{q.help}</p>}
        {suggestion && <p className="mt-1 text-[0.8rem] text-tblue">{suggestion}</p>}
        {q.impact === "high" && !a && <p className="mt-1 text-[0.78rem] font-bold text-warn">Muda a conclusão: responda primeiro</p>}
      </div>
      <div className="grid gap-2">
        {q.type === "multiselect" ? (
          <fieldset>
            <legend className="sr-only">{q.label}</legend>
            <input type="hidden" name={`m|${key}`} value="1" />
            <div className="grid gap-1 sm:grid-cols-2">
              {pack.features.map((f) => (
                <label key={f.id} className="flex items-start gap-2 text-[0.86rem]">
                  <input type="checkbox" name={`v|${key}`} value={f.id} defaultChecked={values.includes(f.id)} className="mt-1 accent-vivo" />
                  <span>
                    {f.name}
                    <span className="block text-[0.74rem] text-faint">{featureTierLabel(pack, f.tiers)}</span>
                  </span>
                </label>
              ))}
              <label className="flex items-start gap-2 text-[0.86rem] text-muted">
                <input type="checkbox" name={`v|${key}`} value="__none" defaultChecked={!!a && values.length === 0} className="mt-1 accent-vivo" />
                Nenhum destes
              </label>
            </div>
          </fieldset>
        ) : q.type === "select" ? (
          <select id={`f-${key}`} name={`v|${key}`} className="select" defaultValue={a?.value ?? ""}>
            <option value="">Não informado</option>
            {q.options!.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input id={`f-${key}`} name={`v|${key}`} type={q.type === "date" ? "date" : q.type === "number" ? "number" : "text"} min={q.type === "number" ? 0 : undefined} className="input" defaultValue={a?.value ?? ""} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <OriginSelect name={`o|${key}`} value={a?.origin} />
          <input name={`e|${key}`} className="input min-w-0 flex-1 py-1 text-[0.8rem]" placeholder="Evidência (ex.: relatório do portal, 10/10)" defaultValue={a?.evidence ?? ""} aria-label="Evidência" />
        </div>
        {a?.author && <p className="text-[0.74rem] text-faint">Respondido por {a.author}</p>}
      </div>
    </div>
  );
}

export default async function DiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { result, input, answers } = await loadAnalysis(id);
  const families = result.families.map((f) => ({ ...f, pack: getPack(f.familyId)! })).filter((f) => f.pack);

  if (families.length === 0) {
    return (
      <EmptyState title="Nenhuma família de produtos identificada" action={<Link href={`/app/analyses/${id}/import`} className="btn btn-primary">Importar itens</Link>}>
        As perguntas de utilização dependem do produto. Importe os itens ou marque as famílias esperadas no resumo da análise.
      </EmptyState>
    );
  }

  const find = (fam: string, key: string, model?: string) => answers.find((a) => a.familyId === fam && a.questionKey === key && (a.model || "") === (model ?? ""));
  const asAnswer = (row: ReturnType<typeof find>): Answer | undefined =>
    row ? { familyId: row.familyId, model: row.model, questionKey: row.questionKey, value: row.value, origin: row.origin as EvidenceOrigin, evidence: row.evidence, author: row.author } : undefined;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h-section">Como o cliente usa</h2>
          <p className="lead mt-1">As perguntas mudam conforme o produto. Toda resposta guarda origem e evidência, e a confiança das conclusões depende delas.</p>
        </div>
        <EvidenceLegend />
      </div>

      {families.map(({ pack, pending, familyId }) => {
        const ctx = buildContext(input, result.items, familyId);
        const models = [...modelsInScope(ctx).keys()].sort();
        const hwDoc = sumQty(ctx.hardwareItems);
        const familyQs = pack.questions.filter((q) => q.scope === "family");
        const modelQs = pack.questions.filter((q) => q.scope === "model" && MODEL_KEYS.includes(q.key));
        const lifeQs = pack.questions.filter((q) => q.scope === "model" && !MODEL_KEYS.includes(q.key));
        const collected = [Q.licensesContracted, Q.licensesEdition, Q.licensesExpiration, Q.unitsOnline].map((k) => find(familyId, k)).filter(Boolean);
        return (
          <section key={familyId} className="panel" aria-labelledby={`h-${familyId}`}>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h3 id={`h-${familyId}`} className="h-section">
                  {pack.name}
                </h3>
                <p className="text-[0.85rem] text-muted">
                  {pack.technology}. Licença {METRIC[pack.metric].toLowerCase()}.
                </p>
              </div>
              <PackStatus status={pack.status} />
            </header>

            {pending.length > 0 && (
              <div className="border-b border-line bg-warn-bg/50 px-5 py-3">
                <p className="text-[0.85rem] font-bold text-warn">Pendências desta família</p>
                <ul className="mt-1 grid gap-0.5 text-[0.85rem]">
                  {pending.map((p) => (
                    <li key={p.answerKey}>
                      <a className="link" href={`#${p.answerKey}`}>
                        {p.label}
                      </a>{" "}
                      <span className="text-muted">{p.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {collected.length > 0 && (
              <div className="border-b border-line bg-tblue-50/60 px-5 py-3 text-[0.85rem]">
                <p className="flex items-center gap-2 font-bold text-tblue">
                  <EvidenceMark origin="collected" /> Dados coletados no portal do fabricante
                </p>
                <ul className="mt-1 grid gap-0.5">
                  {collected.map((c) => (
                    <li key={c!.questionKey}>
                      {
                        {
                          [Q.licensesContracted]: "Limite de licenças",
                          [Q.licensesEdition]: "Edição",
                          [Q.licensesExpiration]: "Vencimento (co-term)",
                          [Q.unitsOnline]: "Equipamentos online",
                        }[c!.questionKey]
                      }
                      : <strong>{c!.questionKey === Q.licensesExpiration ? formatDate(c!.value) : c!.value}</strong>
                      <span className="text-muted"> ({c!.evidence})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form action={saveAnswersAction} className="flex flex-col px-5 pb-5">
              <input type="hidden" name="analysisId" value={id} />
              {/* Firewalls: o parque por modelo vem primeiro, porque é o que muda a quantidade. */}
              <div className={pack.metric === "HARDWARE_ATTACHED" ? "order-2" : ""}>
                {familyQs.map((q) => (
                  <QuestionField
                    key={q.key}
                    pack={pack}
                    q={q}
                    a={asAnswer(find(familyId, q.key))}
                    suggestion={q.key === Q.unitsInstalled && hwDoc > 0 && !find(familyId, q.key) ? `A lista importada tem ${hwDoc} equipamentos. Sem resposta, o motor usa esse número como documentado.` : undefined}
                  />
                ))}
              </div>

              {pack.metric === "HARDWARE_ATTACHED" && models.length > 0 && (
                <div className="order-1 mt-4 mb-2">
                  <h4 className="h-sub">Parque por modelo</h4>
                  <p className="hint mb-2">Uma linha por modelo encontrado nos itens. A origem e a evidência valem para a linha toda.</p>
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Modelo</th>
                          {modelQs.map((q) => (
                            <th key={q.key} className="right" title={q.help}>
                              {q.label}
                            </th>
                          ))}
                          <th>Origem</th>
                          <th>Evidência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {models.map((m) => {
                          const hw = sumQty(ctx.hardwareItems.filter((i) => i.model === m));
                          const rowOrigin = modelQs.map((q) => find(familyId, q.key, m)?.origin).find(Boolean) as EvidenceOrigin | undefined;
                          const rowEvidence = modelQs.map((q) => find(familyId, q.key, m)?.evidence).find(Boolean);
                          return (
                            <tr key={m} id={answerKey(familyId, Q.unitsActive, m)}>
                              <td className="whitespace-nowrap font-bold">
                                {m}
                                {hw > 0 && <div className="text-[0.74rem] font-normal text-muted">{hw} na lista</div>}
                              </td>
                              {modelQs.map((q) => (
                                <td key={q.key} className="right">
                                  <input
                                    name={`v|${familyId}|${m}|${q.key}`}
                                    type="number"
                                    min={0}
                                    className="input w-24 text-right"
                                    defaultValue={find(familyId, q.key, m)?.value ?? ""}
                                    aria-label={`${m}: ${q.label}`}
                                    placeholder={q.key === Q.unitsInstalled && hw ? String(hw) : ""}
                                  />
                                </td>
                              ))}
                              <td>
                                <OriginSelect name={`orow|${familyId}|${m}|units`} value={rowOrigin} />
                              </td>
                              <td>
                                <input name={`erow|${familyId}|${m}|units`} className="input min-w-40 py-1 text-[0.8rem]" defaultValue={rowEvidence ?? ""} aria-label={`Evidência ${m}`} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {models.length > 0 && lifeQs.length > 0 && (
                <details className="order-3 mt-4 rounded-lg border border-line">
                  <summary className="cursor-pointer px-4 py-3 text-[0.9rem] font-bold">Datas de ciclo de vida por modelo</summary>
                  <div className="overflow-x-auto border-t border-line">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Modelo</th>
                          <th>Catálogo</th>
                          {lifeQs.map((q) => (
                            <th key={q.key}>{q.label}</th>
                          ))}
                          <th>Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {models.map((m) => {
                          const hw = pack.hardware.find((h) => h.model === m);
                          const lc = hw?.lifecycle;
                          const rowOrigin = lifeQs.map((q) => find(familyId, q.key, m)?.origin).find(Boolean) as EvidenceOrigin | undefined;
                          return (
                            <tr key={m} id={answerKey(familyId, Q.eoxEndOfSupport, m)}>
                              <td className="whitespace-nowrap font-bold">{m}</td>
                              <td className="text-[0.8rem] text-muted">
                                {lc?.endOfSupportAt ? `Fim de suporte ${formatDate(lc.endOfSupportAt)}` : lc?.status === "validated" ? "Sem anúncio de fim de venda" : "Sem datas no catálogo"}
                              </td>
                              {lifeQs.map((q) => (
                                <td key={q.key}>
                                  <input type="date" name={`v|${familyId}|${m}|${q.key}`} className="input" defaultValue={find(familyId, q.key, m)?.value ?? ""} aria-label={`${m}: ${q.label}`} />
                                </td>
                              ))}
                              <td>
                                <OriginSelect name={`orow|${familyId}|${m}|life`} value={rowOrigin} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="hint px-4 py-3">Datas informadas aqui têm prioridade sobre o catálogo. Use a evidência do portal do fabricante.</p>
                </details>
              )}

              <div className="order-4 mt-5 flex flex-wrap items-end justify-end gap-3">
                <div className="field w-56">
                  <label className="label" htmlFor={`author-${familyId}`}>
                    Respondido por
                  </label>
                  <input id={`author-${familyId}`} name="author" className="input" defaultValue="Pré-vendas" />
                </div>
                <SubmitButton>Salvar respostas de {pack.name}</SubmitButton>
              </div>
            </form>
          </section>
        );
      })}
    </div>
  );
}
