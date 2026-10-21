import Link from "next/link";
import { ALL_VENDORS, PACKS } from "@/packs";
import { METRIC } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { PageHeader, PackStatus } from "@/components/ui";

export const metadata = { title: "Catálogo" };

export default function CatalogPage() {
  const vendors = [...new Set(PACKS.map((p) => p.vendorName))];
  const withoutPack = ALL_VENDORS.filter((v) => !v.hasPack);
  return (
    <>
      <PageHeader
        title="Catálogo de fabricantes"
        lead="O núcleo do VITA Lens é o mesmo para todos. O conhecimento de cada fabricante fica em um pacote: SKUs, níveis, recursos, ciclo de vida, regras, perguntas e fontes."
      />
      <div className="grid gap-6">
        {vendors.map((v) => (
          <section key={v}>
            <h2 className="h-section mb-2">{v}</h2>
            <div className="panel">
              {PACKS.filter((p) => p.vendorName === v).map((p) => (
                <Link key={p.id} href={`/app/catalog/${p.id}`} className="grid gap-2 border-b border-line px-5 py-4 last:border-b-0 hover:bg-vivo-50 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-[0.84rem] text-muted">
                      {p.technology}. {METRIC[p.metric]}.
                    </p>
                  </div>
                  <p className="num text-[0.84rem] text-muted">
                    {p.skus.length} SKUs, {p.hardware.length} modelos, {p.features.length} recursos
                  </p>
                  <p className="text-[0.84rem] text-muted">
                    {p.sources.filter((s) => s.official).length} fontes oficiais. Conferido em {formatDate(p.validatedAt)}
                  </p>
                  <PackStatus status={p.status} />
                </Link>
              ))}
            </div>
          </section>
        ))}
        <section className="panel p-5">
          <h2 className="h-sub">Fabricantes reconhecidos sem pacote</h2>
          <p className="mt-1 text-[0.9rem] text-muted">
            {withoutPack.map((v) => v.name).join(", ")}. Os itens desses fabricantes são identificados pelo formato do part number e vão para revisão manual. Um pacote novo é um arquivo em <span className="sku">src/packs</span> registrado em <span className="sku">src/packs/index.ts</span>.
          </p>
        </section>
      </div>
    </>
  );
}
