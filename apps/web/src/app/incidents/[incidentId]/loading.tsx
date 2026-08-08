export default function LoadingIncident() {
  return (
    <main className="mx-auto max-w-6xl animate-pulse px-6 py-12">
      <div className="h-4 w-36 rounded bg-slate-800" />
      <div className="mt-8 h-9 w-2/3 rounded bg-slate-800" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="h-80 rounded-xl bg-slate-900" />
        <div className="h-72 rounded-xl bg-slate-900" />
      </div>
    </main>
  );
}
