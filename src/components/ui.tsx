import Link from "next/link";
import type { Confidence, EvidenceOrigin, QuantityLedger, Severity } from "@/domain/types";
import { CONFIDENCE, ORIGIN, ORIGIN_HELP, SEVERITY, STATUS } from "@/lib/labels";
import { findSource } from "@/packs";

/** Marca da lente: anel com ponto central. Mesma geometria das marcas de evidência. */
export function LensMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#D84AFF" strokeWidth="3" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" />
    </svg>
  );
}

/**
 * Marca de evidência. A "lente" vai fechando conforme a evidência fica mais forte:
 * anel vazio (declarada), meio preenchido (documentada), cheio (coletada),
 * cheio com visto (validada).
 */
export function EvidenceMark({ origin, size = 12 }: { origin: EvidenceOrigin; size?: number }) {
  const blue = "#0066FF";
  const purple = "#6E00A7";
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={`Evidência ${ORIGIN[origin].toLowerCase()}`} className="shrink-0">
      <title>{`${ORIGIN[origin]}: ${ORIGIN_HELP[origin]}`}</title>
      {origin === "declared" && <circle cx="6" cy="6" r="4.6" fill="#fff" stroke={blue} strokeWidth="1.6" />}
      {origin === "documented" && (
        <>
          <circle cx="6" cy="6" r="4.6" fill="#fff" stroke={blue} strokeWidth="1.6" />
          <path d="M6 1.4 A4.6 4.6 0 0 0 6 10.6 Z" fill={blue} />
        </>
      )}
      {origin === "collected" && <circle cx="6" cy="6" r="5.4" fill={blue} />}
      {origin === "validated" && (
        <>
          <circle cx="6" cy="6" r="5.4" fill={purple} />
          <path d="M3.4 6.2 5.2 8 8.7 4.3" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function OriginTag({ origin }: { origin: EvidenceOrigin }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8rem] text-muted" title={ORIGIN_HELP[origin]}>
      <EvidenceMark origin={origin} />
      {ORIGIN[origin]}
    </span>
  );
}

export function EvidenceLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-muted">
      {(["declared", "documented", "collected", "validated"] as const).map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5" title={ORIGIN_HELP[o]}>
          <EvidenceMark origin={o} /> {ORIGIN[o]}
        </span>
      ))}
    </div>
  );
}

export const SEVERITY_STYLE: Record<Severity, { fg: string; bg: string; bar: string }> = {
  critical: { fg: "text-crit", bg: "bg-crit-bg", bar: "bg-crit" },
  attention: { fg: "text-warn", bg: "bg-warn-bg", bar: "bg-warn" },
  opportunity: { fg: "text-opp", bg: "bg-opp-bg", bar: "bg-opp" },
  ok: { fg: "text-ok", bg: "bg-ok-bg", bar: "bg-ok" },
  info: { fg: "text-info", bg: "bg-info-bg", bar: "bg-line-strong" },
};

function SeverityGlyph({ severity }: { severity: Severity }) {
  // Formas diferentes por severidade: a cor nunca é o único sinal.
  if (severity === "critical") return <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><rect x="1" y="1" width="8" height="8" fill="currentColor" /></svg>;
  if (severity === "attention") return <svg width="10" height="9" viewBox="0 0 10 9" aria-hidden><path d="M5 0.5 9.6 8.5H0.4Z" fill="currentColor" /></svg>;
  if (severity === "opportunity") return <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" /></svg>;
  if (severity === "ok") return <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M1.5 5.2 4 7.6 8.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
  return <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

export function SeverityTag({ severity, label }: { severity: Severity; label?: string }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span className={`chip ${s.bg} ${s.fg}`}>
      <SeverityGlyph severity={severity} />
      {label ?? SEVERITY[severity]}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-info-bg text-info",
  COLLECTING_DATA: "bg-tblue-50 text-tblue",
  WAITING_CUSTOMER: "bg-warn-bg text-warn",
  PROCESSING: "bg-tblue-50 text-tblue",
  NEEDS_REVIEW: "bg-vivo-50 text-vivo",
  TECHNICALLY_REVIEWED: "bg-vivo-50 text-vivo",
  APPROVED: "bg-ok-bg text-ok",
  REJECTED: "bg-crit-bg text-crit",
  EXPORTED: "bg-ok-bg text-ok",
  ARCHIVED: "bg-info-bg text-info",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`chip ${STATUS_TONE[status] ?? "bg-info-bg text-info"}`}>{STATUS[status] ?? status}</span>;
}

export function ConfidenceText({ value }: { value: Confidence }) {
  const bars = value === "high" ? 3 : value === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8rem] text-muted" title="Confiança calculada pela origem das evidências e pela situação do catálogo">
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-[3px] rounded-sm ${i <= bars ? "bg-vivo" : "bg-line-strong"}`} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      Confiança {CONFIDENCE[value].toLowerCase()}
    </span>
  );
}

export function PackStatus({ status }: { status: "validated" | "draft" }) {
  return status === "validated" ? (
    <span className="chip bg-ok-bg text-ok">Catálogo validado</span>
  ) : (
    <span className="chip bg-warn-bg text-warn">Catálogo em rascunho</span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <p className="h-section">{title}</p>
      {children && <div className="lead mx-auto mt-2">{children}</div>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Régua de quantidades: contratado, instalado, em uso, contingência e necessário lado a lado. */
export function Ledger({ ledger }: { ledger: QuantityLedger }) {
  const rows = ledger.rows.filter((r) => r.value != null);
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="mt-3 grid gap-1.5" role="table" aria-label="Comparação de quantidades">
      {rows.map((r) => (
        <div key={r.key} role="row" className="grid grid-cols-[minmax(8rem,12rem)_1fr_3.5rem] items-center gap-3 text-[0.82rem]">
          <span role="cell" className={r.emphasis ? "font-bold" : "text-muted"}>
            {r.label}
          </span>
          <span role="cell" className="h-2.5 rounded-sm bg-mist" aria-hidden>
            <span
              className={`block h-full rounded-sm ${r.emphasis ? "bg-vivo" : r.key === "contracted" || r.key.startsWith("svc-") ? "bg-tblue" : "bg-line-strong"}`}
              style={{ width: `${((r.value ?? 0) / max) * 100}%` }}
            />
          </span>
          <span role="cell" className={`num text-right ${r.emphasis ? "font-bold" : ""}`}>
            {r.value}
          </span>
        </div>
      ))}
      {ledger.difference != null && ledger.difference !== 0 && (
        <p className="mt-1 text-[0.82rem] text-muted">
          Diferença entre contratado e necessário: <strong className="num text-navy">{ledger.difference > 0 ? `+${ledger.difference}` : ledger.difference}</strong>
        </p>
      )}
    </div>
  );
}

export function SourceLinks({ ids }: { ids: string[] }) {
  const sources = [...new Set(ids)].map((id) => findSource(id)).filter(Boolean);
  if (sources.length === 0) return null;
  return (
    <span className="text-[0.8rem] text-muted">
      Fonte:{" "}
      {sources.map((s, i) => (
        <span key={s!.id}>
          {i > 0 && ", "}
          <a className="link" href={s!.url} target="_blank" rel="noreferrer">
            {s!.title}
          </a>
          {!s!.official && " (não oficial)"}
        </span>
      ))}
    </span>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: Severity }) {
  const body = (
    <>
      <span className={`num block text-[1.6rem] font-bold leading-none ${tone ? SEVERITY_STYLE[tone].fg : "text-navy"}`}>{value}</span>
      <span className="mt-1.5 block text-[0.82rem] text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg px-4 py-3 hover:bg-vivo-50">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-3">{body}</div>
  );
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h-page">{title}</h1>
        {lead && <p className="lead mt-1.5">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
