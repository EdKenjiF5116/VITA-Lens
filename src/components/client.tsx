"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[0.92rem] font-bold ${
        active ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
      }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-helio" aria-hidden />}
      {children}
    </Link>
  );
}

export function StepLink({ href, n, label, badge, exact }: { href: string; n?: number; label: string; badge?: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 text-[0.88rem] font-bold ${
        active ? "border-vivo text-vivo" : "border-transparent text-muted hover:text-navy"
      }`}
    >
      {n != null && (
        <span
          className={`num grid h-5 w-5 place-items-center rounded-full text-[0.72rem] ${active ? "bg-vivo text-white" : "bg-line text-muted group-hover:bg-line-strong"}`}
        >
          {n}
        </span>
      )}
      {label}
      {badge}
    </Link>
  );
}

export function SubmitButton({ children, className = "btn btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText ?? "Salvando..." : children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </button>
  );
}
