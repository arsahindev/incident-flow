import Link from "next/link";

export default function IncidentNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Incident not found</h1>
      <p className="mt-3 text-slate-400">
        This incident does not exist in the current development organization.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
      >
        Return to dashboard
      </Link>
    </main>
  );
}
