import Link from "next/link";
import { LensMark } from "@/components/ui";
import { NavLink } from "@/components/client";

// Todas as telas leem o banco a cada requisição.
export const dynamic = "force-dynamic";

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[236px_1fr] print:block">
      <aside className="no-print bg-plum text-white md:sticky md:top-0 md:h-screen">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:block md:px-5 md:py-6">
          <Link href="/app" className="flex items-center gap-2.5">
            <LensMark size={26} />
            <span className="text-[1.15rem] font-bold tracking-tight">VITA Lens</span>
          </Link>
          <p className="mt-2 hidden text-[0.78rem] leading-snug text-white/65 md:block">Análise de renovações com evidência e revisão humana</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:overflow-visible md:pb-0" aria-label="Principal">
          <NavLink href="/app" exact>
            <Icon d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />
            Painel
          </NavLink>
          <NavLink href="/app/analyses">
            <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6M11 8v6" />
            Análises
          </NavLink>
          <NavLink href="/app/clients">
            <Icon d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />
            Clientes
          </NavLink>
          <NavLink href="/app/catalog">
            <Icon d="M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4" />
            Catálogo
          </NavLink>
        </nav>
        <div className="absolute bottom-0 hidden w-[236px] px-5 pb-5 text-[0.75rem] leading-snug text-white/55 md:block">
          Protótipo com dados de demonstração. Conclusões dependem de validação de um especialista.
        </div>
      </aside>
      <main className="print-full min-w-0 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
