/** Datas no formato AAAA-MM-DD, sem fuso horário, para evitar deslocamentos. */

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
}

export function toUtc(d: string): Date {
  return new Date(d + "T00:00:00Z");
}

export function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addMonths(d: string, months: number): string {
  const dt = toUtc(d);
  const day = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + months);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(day, last));
  return fromUtc(dt);
}

export function addDays(d: string, days: number): string {
  const dt = toUtc(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Meses completos entre duas datas (negativo se "to" for anterior). */
export function monthsBetween(from: string, to: string): number {
  const a = toUtc(from);
  const b = toUtc(to);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
}

export function todayIso(): string {
  return fromUtc(new Date());
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatDate(d?: string | null): string {
  if (!d || !isIsoDate(d)) return "sem data";
  const dt = toUtc(d);
  return `${String(dt.getUTCDate()).padStart(2, "0")} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/**
 * Converte datas comuns em planilhas brasileiras e exportações de portais.
 * Aceita AAAA-MM-DD, DD/MM/AAAA, DD-MM-AAAA, número serial do Excel e Date.
 */
export function parseLooseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return fromUtc(v);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const epoch = Date.UTC(1899, 11, 30);
    return fromUtc(new Date(epoch + v * 86_400_000));
  }
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return isIsoDate(`${iso[1]}-${iso[2]}-${iso[3]}`) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    const out = `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    return isIsoDate(out) ? out : null;
  }
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : fromUtc(new Date(parsed));
}
