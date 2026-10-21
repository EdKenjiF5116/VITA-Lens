import { PACKS } from "@/packs";
import { METRIC } from "@/lib/labels";
import { PackStatus } from "./ui";

/** Seleção de famílias esperadas, agrupadas por fabricante. */
export function FamilyPicker({ selected = [] }: { selected?: string[] }) {
  const vendors = [...new Set(PACKS.map((p) => p.vendorName))];
  return (
    <fieldset className="field">
      <legend className="label">Fabricantes e famílias esperadas</legend>
      <p className="hint mb-2">Opcional. O VITA Lens também detecta as famílias pelos SKUs importados. Marcar aqui já libera as perguntas de utilização.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {vendors.map((v) => (
          <div key={v} className="rounded-lg border border-line bg-white p-3">
            <p className="h-sub mb-1.5">{v}</p>
            {PACKS.filter((p) => p.vendorName === v).map((p) => (
              <label key={p.id} className="flex items-start gap-2 py-1 text-[0.88rem]">
                <input type="checkbox" name="families" value={p.id} defaultChecked={selected.includes(p.id)} className="mt-1 accent-vivo" />
                <span>
                  {p.name}
                  <span className="block text-[0.78rem] text-muted">
                    {p.technology}, {METRIC[p.metric].toLowerCase()}
                  </span>
                </span>
                <span className="ml-auto">{p.status === "draft" && <PackStatus status="draft" />}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function TermSelect({ value = 36, name = "termMonths" }: { value?: number; name?: string }) {
  return (
    <select name={name} defaultValue={String(value)} className="select">
      {[12, 24, 36, 48, 60].map((m) => (
        <option key={m} value={m}>
          {m} meses
        </option>
      ))}
    </select>
  );
}
