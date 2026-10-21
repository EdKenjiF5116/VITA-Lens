import type { Finding } from "@/domain/types";
import { DIMENSION, RECOMMENDATION, VERDICT } from "@/lib/labels";
import { ConfidenceText, EvidenceMark, Ledger, SeverityTag, SEVERITY_STYLE, SourceLinks } from "./ui";

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function FindingRow({ f, review, compact }: { f: Finding; review?: { decision: string; comment?: string | null; reviewer?: string | null }; compact?: boolean }) {
  const s = SEVERITY_STYLE[f.severity];
  return (
    <article className="relative border-b border-line py-4 pl-5 pr-4 last:border-b-0" id={f.key}>
      <span className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${s.bar}`} aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <SeverityTag severity={f.severity} />
        <span className="text-[0.8rem] text-muted">
          {DIMENSION[f.dimension]}: {lowerFirst(VERDICT[f.verdict] ?? f.verdict)}
        </span>
        {review && (
          <span className={`chip ${review.decision === "rejected" ? "bg-crit-bg text-crit" : "bg-vivo-50 text-vivo"}`}>
            {review.decision === "accepted" ? "Aceita" : review.decision === "rejected" ? "Rejeitada" : "Ajustada"}
            {review.reviewer ? ` por ${review.reviewer}` : ""}
          </span>
        )}
      </div>
      <h3 className="mt-1.5 text-[1rem] font-bold leading-snug">{f.title}</h3>
      <p className="mt-1 max-w-[78ch] text-[0.9rem] text-muted">{f.explanation}</p>
      {f.recommendation && (
        <p className="mt-2 max-w-[78ch] text-[0.9rem]">
          <strong>{RECOMMENDATION[f.recommendation.type]}:</strong> {f.recommendation.text}
        </p>
      )}
      {!compact && f.ledger && <div className="max-w-xl">{<Ledger ledger={f.ledger} />}</div>}
      {!compact && f.evidence.length > 0 && (
        <ul className="mt-3 grid gap-1 text-[0.82rem]">
          {f.evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-[3px]">
                <EvidenceMark origin={e.origin} />
              </span>
              <span>
                <span className="text-muted">{e.label}:</span> <span className="font-bold">{e.value}</span>
                {e.detail && <span className="text-faint"> ({e.detail})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {review?.comment && <p className="mt-2 rounded-md bg-vivo-50 px-3 py-2 text-[0.85rem]">Comentário do revisor: {review.comment}</p>}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <ConfidenceText value={f.confidence} />
          <span className="text-[0.8rem] text-muted">
            Regra {f.rule.id}: {f.rule.name}
          </span>
          <SourceLinks ids={f.sourceIds} />
        </div>
      )}
    </article>
  );
}
