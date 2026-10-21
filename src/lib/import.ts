import { parseLooseDate } from "./dates";

export type FieldKey = "sku" | "description" | "quantity" | "serial" | "startDate" | "endDate" | "contractNumber" | "unitPrice";

export const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "sku", label: "SKU / part number", required: true },
  { key: "description", label: "Descrição" },
  { key: "quantity", label: "Quantidade" },
  { key: "serial", label: "Número de série" },
  { key: "startDate", label: "Início do contrato" },
  { key: "endDate", label: "Vencimento" },
  { key: "contractNumber", label: "Contrato" },
  { key: "unitPrice", label: "Preço unitário (USD)" },
];

const SYNONYMS: Record<FieldKey, string[]> = {
  sku: ["sku", "part number", "partnumber", "part no", "pn", "pid", "product id", "código", "codigo", "item", "produto", "model", "modelo"],
  description: ["descrição", "descricao", "description", "desc", "nome do produto", "product description"],
  quantity: ["quantidade", "qtd", "qtde", "qty", "quantity", "quant"],
  serial: ["serial", "serial number", "número de série", "numero de serie", "s/n", "sn", "serial no"],
  startDate: ["início", "inicio", "start", "start date", "data início", "data inicio", "begin"],
  endDate: ["vencimento", "término", "termino", "end", "end date", "expiration", "expira", "expiração", "data fim", "fim", "license expiration", "licenseexpirationdate", "coterm"],
  contractNumber: ["contrato", "contract", "contract number", "nº contrato", "n contrato", "subscription", "assinatura"],
  unitPrice: ["preço", "preco", "price", "unit price", "valor unitário", "valor unitario", "list price"],
};

const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_]/g, " ").trim();

/** Sugere o mapeamento de colunas pelos nomes do cabeçalho. O usuário confirma na prévia. */
export function guessMapping(headers: string[]): Partial<Record<FieldKey, number>> {
  const out: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();
  const order: FieldKey[] = ["serial", "endDate", "startDate", "contractNumber", "unitPrice", "quantity", "description", "sku"];
  for (const field of order) {
    const syn = SYNONYMS[field].map(clean);
    let best = -1;
    headers.forEach((h, i) => {
      if (used.has(i) || best >= 0) return;
      const c = clean(h);
      if (syn.includes(c)) best = i;
    });
    if (best < 0) {
      headers.forEach((h, i) => {
        if (used.has(i) || best >= 0) return;
        const c = clean(h);
        if (syn.some((s) => s.length > 2 && c.includes(s))) best = i;
      });
    }
    if (best >= 0) {
      out[field] = best;
      used.add(best);
    }
  }
  // Se houver coluna de SKU e de modelo, prefira a que tiver "sku" ou "part".
  return out;
}

export function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (!s) return null;
  // 1.234,56 (pt-BR) ou 1,234.56 (en)
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = /,\d{3}$/.test(s) && !/^0,/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface MappedRow {
  rawSku: string;
  rawDescription: string | null;
  quantity: number;
  serial: string | null;
  startDate: string | null;
  endDate: string | null;
  contractNumber: string | null;
  unitPrice: number | null;
  row: number;
}

export function applyMapping(rows: unknown[][], mapping: Partial<Record<FieldKey, number>>): MappedRow[] {
  const get = (r: unknown[], k: FieldKey) => (mapping[k] != null ? r[mapping[k]!] : undefined);
  const str = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
  return rows
    .map((r, idx) => {
      const sku = str(get(r, "sku"));
      if (!sku && r.every((c) => c == null || String(c).trim() === "")) return null;
      const qty = mapping.quantity != null ? parseNumber(get(r, "quantity")) : 1;
      return {
        rawSku: sku ?? "",
        rawDescription: str(get(r, "description")),
        quantity: qty ?? NaN,
        serial: str(get(r, "serial")),
        startDate: parseLooseDate(get(r, "startDate")),
        endDate: parseLooseDate(get(r, "endDate")),
        contractNumber: str(get(r, "contractNumber")),
        unitPrice: parseNumber(get(r, "unitPrice")),
        row: idx,
      };
    })
    .filter(Boolean) as MappedRow[];
}
