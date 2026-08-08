"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-red-300">Unavailable</p>
      <h1 className="mt-3 text-3xl font-semibold">Incident data could not be loaded</h1>
      <p className="mt-3 text-slate-400">
        Confirm the Fastify API and PostgreSQL container are running, then try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
      >
        Try again
      </button>
    </main>
  );
}
