import { detectVendor, lookupSku, normalizeSku, PACKS } from "@/packs";
import { parseLooseDate } from "@/lib/dates";

export interface ExtractedRow {
  rawSku: string;
  quantity: number;
  endDate: string | null;
  rawDescription: string | null;
  line: number;
  known: boolean;
}

const SKU_TOKEN = /[A-Z0-9][A-Z0-9]*(?:[-/][A-Z0-9]+)+=?|[A-Z]{2,}[0-9]{3,}[A-Z0-9]*/gi;
const DATE_TOKEN = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

function looksLikeSku(token: string): boolean {
  const t = normalizeSku(token);
  if (t.length < 5) return false;
  if (/^\d+([/.-]\d+)+$/.test(t)) return false; // datas e números
  if (lookupSku(t) || PACKS.some((p) => p.parseSku?.(t))) return true;
  if (detectVendor(t)) return true;
  return /[A-Z]/.test(t) && /\d/.test(t) && /-/.test(t);
}

function quantityNear(line: string, sku: string): number {
  const esc = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(\\d{1,6})\\s*(?:x|×|un\\.?|unid\\.?|unidades|pcs)\\s*${esc}`, "i"),
    new RegExp(`${esc}\\s*(?:x|×)\\s*(\\d{1,6})\\b`, "i"),
    /\b(?:qtd|qtde|qty|quantidade|quantity)\.?\s*[:=]?\s*(\d{1,6})\b/i,
    /\b(\d{1,6})\s*(?:licen[cç]as?|usu[aá]rios|aps?|unidades|un\.?|pcs)\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(line);
    if (m) return Number(m[1]);
  }
  // Número isolado na linha (planilha colada), ignorando o próprio SKU e datas.
  const rest = line.replace(sku, " ").replace(DATE_TOKEN, " ").replace(/US\$\s*[\d.,]+|R\$\s*[\d.,]+|\$\s*[\d.,]+/gi, " ");
  const nums = [...rest.matchAll(/(?:^|[\s;\t|,])(\d{1,6})(?=$|[\s;\t|,])/g)].map((m) => Number(m[1]));
  return nums.find((n) => n > 0) ?? 1;
}

/**
 * Extrai SKUs, quantidades e vencimentos de texto livre: e-mail, proposta ou
 * texto copiado de PDF. Regras simples e previsíveis; o resultado vai para a
 * prévia antes de entrar na análise.
 */
export function extractFromText(text: string): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const tokens = [...line.matchAll(SKU_TOKEN)].map((m) => m[0]).filter(looksLikeSku);
    if (tokens.length === 0) return;
    const dates = [...line.matchAll(DATE_TOKEN)].map((m) => parseLooseDate(m[1])).filter(Boolean) as string[];
    const endDate = dates.length ? dates.sort()[dates.length - 1] : null;
    for (const token of tokens) {
      const sku = normalizeSku(token);
      const description = line.replace(token, "").replace(/\s{2,}/g, " ").trim().slice(0, 140) || null;
      rows.push({
        rawSku: sku,
        quantity: quantityNear(line, token),
        endDate,
        rawDescription: description,
        line: idx + 1,
        known: !!(lookupSku(sku) || PACKS.some((p) => p.parseSku?.(sku))),
      });
    }
  });
  return rows;
}
