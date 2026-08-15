import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-8">
          <Link href="/" className="group">
            <p className="text-lg font-semibold tracking-tight group-hover:text-cyan-300">
              IncidentFlow
            </p>
            <p className="text-sm text-slate-400">Development organization</p>
          </Link>
          <nav className="flex gap-4 text-sm text-slate-300" aria-label="Primary navigation">
            <Link href="/" className="hover:text-cyan-300">Incidents</Link>
            <Link href="/services" className="hover:text-cyan-300">Services</Link>
          </nav>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Local environment
        </span>
      </div>
    </header>
  );
}
