const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function money(v: number | null | undefined): string {
  return v == null ? "sem preço" : usd.format(v);
}

export function termLabel(m?: number | null): string {
  if (!m) return "";
  return m % 12 === 0 ? `${m / 12} ${m === 12 ? "ano" : "anos"}` : `${m} meses`;
}
