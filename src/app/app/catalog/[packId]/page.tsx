import { notFound } from "next/navigation";
import { getPack } from "@/packs";
import { CATEGORY, METRIC } from "@/lib/labels";
import { formatDate, todayIso } from "@/lib/dates";
import { termLabel } from "@/lib/format";
import { PageHeader, PackStatus, SourceLinks } from "@/components/ui";

export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const pack = getPack(packId);
  if (!pack) notFound();
  const levels = pack.tiers.length ? pack.tiers : pack.addons ?? [];
  const today = todayIso();

  return (
    <>
      <PageHeader title={pack.name} lead={`${pack.vendorName}. ${pack.technology}. Licença ${METRIC[pack.metric].toLowerCase()}${pack.coterm ? ", co-terminada" : ""}.`} actions={<PackStatus status={pack.status} />} />
      {pack.notes && (
        <ul className="panel mb-6 list-disc py-3 pl-9 pr-5 text-[0.88rem] text-muted">
          {pack.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-6">
        <section>
          <h2 className="h-section mb-2">{pack.tiers.length ? "Níveis e recursos" : "Assinaturas e recursos"}</h2>
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Recurso</th>
                  {levels.map((t) => (
                    <th key={t.id} className="text-center">
                      {t.name}
                    </th>
                  ))}
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {pack.features.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.name}
                      {f.description && <div className="text-[0.76rem] text-muted">{f.description}</div>}
                      {f.needsService && <div className="text-[0.76rem] text-vivo">Costuma exigir serviço de implantação</div>}
                    </td>
                    {levels.map((t) => (
                      <td key={t.id} className="text-center">
                        {f.tiers.includes(t.id) ? <span className="font-bold text-ok" aria-label="Incluído">✓</span> : <span className="text-[0.8rem] text-faint">não</span>}
                      </td>
                    ))}
                    <td>
                      <SourceLinks ids={f.sourceIds} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {pack.hardware.length > 0 && (
          <section>
            <h2 className="h-section mb-2">Ciclo de vida do hardware</h2>
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Fim de venda</th>
                    <th>Última renovação</th>
                    <th>Fim de suporte</th>
                    <th>Situação hoje</th>
                    <th>Sucessor</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.hardware.map((h) => {
                    const lc = h.lifecycle;
                    const state = !lc || lc.status === "draft" ? "Não confirmado" : lc.endOfSupportAt && lc.endOfSupportAt <= today ? "Fora de suporte" : lc.endOfSaleAt ? "Fim de venda anunciado" : "Ativo";
                    return (
                      <tr key={h.model}>
                        <td>
                          <span className="font-bold">{h.model}</span>
                          <div className="sku text-[0.74rem] text-muted">{h.skus.join(", ")}</div>
                        </td>
                        <td className="text-[0.85rem]">{lc?.endOfSaleAt ? formatDate(lc.endOfSaleAt) : ""}</td>
                        <td className="text-[0.85rem]">{lc?.lastRenewalAt ? formatDate(lc.lastRenewalAt) : ""}</td>
                        <td className="text-[0.85rem]">{lc?.endOfSupportAt ? formatDate(lc.endOfSupportAt) : ""}</td>
                        <td className={`text-[0.85rem] ${state === "Fora de suporte" ? "text-crit" : state === "Fim de venda anunciado" ? "text-warn" : state === "Ativo" ? "text-ok" : "text-muted"}`}>{state}</td>
                        <td className="text-[0.82rem]">
                          {h.successors?.map((s) => (
                            <div key={s.sku}>
                              {s.model}
                              {s.status === "draft" && <span className="text-faint"> (sugestão)</span>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="h-section mb-2">SKUs cadastrados</h2>
          <div className="panel max-h-[28rem] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Nível</th>
                  <th>Prazo</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {pack.skus.map((s) => (
                  <tr key={s.sku}>
                    <td className="sku whitespace-nowrap">{s.sku}</td>
                    <td className="text-[0.85rem]">
                      {s.description}
                      {s.legacy && <div className="text-[0.76rem] text-warn">Substituído por {s.legacy.replacedBy}</div>}
                    </td>
                    <td className="text-[0.85rem]">{CATEGORY[s.category]}</td>
                    <td className="text-[0.85rem]">{levels.find((t) => t.id === s.tierId)?.name ?? ""}</td>
                    <td className="text-[0.85rem]">{termLabel(s.termMonths)}</td>
                    <td className="text-[0.82rem]">{s.status === "validated" ? "Validado" : "Rascunho"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pack.parseSku && <p className="hint mt-2">Este pacote também reconhece part numbers pelo padrão do fabricante, além da lista acima.</p>}
        </section>

        {pack.rules.length > 0 && (
          <section>
            <h2 className="h-section mb-2">Regras específicas</h2>
            <div className="panel">
              {pack.rules.map((r) => (
                <div key={r.id} className="border-b border-line px-5 py-3 last:border-b-0">
                  <p className="font-bold">
                    <span className="sku mr-2 text-muted">{r.id}</span>
                    {r.name}
                  </p>
                  <p className="text-[0.88rem] text-muted">{r.description}</p>
                  <SourceLinks ids={r.sourceIds} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="h-section mb-2">Fontes</h2>
          <div className="panel">
            {pack.sources.map((s) => (
              <div key={s.id} className="border-b border-line px-5 py-3 last:border-b-0 text-[0.88rem]">
                <a href={s.url} className="link font-bold" target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <span className="text-muted">
                  {" "}
                  {s.publisher}. {s.official ? "Oficial" : "Não oficial"}. {s.accessedAt ? `Conferida em ${formatDate(s.accessedAt)}.` : "Ainda não conferida."}
                </span>
                {s.note && <p className="text-[0.8rem] text-faint">{s.note}</p>}
              </div>
            ))}
          </div>
          <p className="hint mt-2">
            Pacote conferido em {formatDate(pack.validatedAt)} por {pack.validatedBy}. Termos suportados: {pack.supportedTerms.map((t) => termLabel(t)).join(", ")}.
          </p>
        </section>
      </div>
    </>
  );
}
