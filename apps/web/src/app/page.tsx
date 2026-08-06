const summaryCards = [
  { label: "Open incidents", value: "0", detail: "No active incidents" },
  { label: "Acknowledged", value: "0", detail: "Nothing needs follow-up" },
  { label: "Resolved today", value: "0", detail: "Ready for the first incident" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-lg font-semibold tracking-tight">IncidentFlow</p>
            <p className="text-sm text-slate-400">Development organization</p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            All systems operational
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">
              Operations
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Incident dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Monitor, coordinate, and resolve service incidents from one place.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 opacity-60"
          >
            Create incident · Phase 1
          </button>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Incident summary">
          {summaryCards.map((card) => (
            <article key={card.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold">Recent incidents</h2>
          </div>
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full border border-slate-700 bg-slate-800 p-3 text-xl" aria-hidden="true">
              ✓
            </div>
            <p className="mt-4 font-medium">No incidents yet</p>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              The first product slice will add persisted incident creation, status changes, and an activity timeline.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
