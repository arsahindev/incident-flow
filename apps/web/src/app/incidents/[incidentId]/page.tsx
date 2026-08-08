import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ApiError, getIncident, getTeams } from "@/lib/api";

import { PriorityBadge, StatusBadge } from "../../ui/badges";
import { IncidentControls } from "../../ui/incident-controls";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  await connection();
  const { incidentId } = await params;

  let incidentResponse;
  try {
    incidentResponse = await getIncident(incidentId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { teams } = await getTeams();
  const { incident } = incidentResponse;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
        ← Back to dashboard
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Incident {incident.id.slice(0, 8)}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">
            {incident.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <PriorityBadge priority={incident.priority} />
            <StatusBadge status={incident.status} />
          </div>
        </div>
        <p className="text-sm text-slate-500">Created {formatDate(incident.createdAt)}</p>
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-300">
              {incident.description || "No description was provided."}
            </p>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="font-semibold">Activity timeline</h2>
            </div>
            <ol className="divide-y divide-slate-800">
              {incident.activity.map((entry) => (
                <li key={entry.id} className="flex gap-4 px-6 py-5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" />
                  <div>
                    <p className="text-sm text-slate-200">{entry.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(entry.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold">Coordinate response</h2>
          <p className="mt-1 text-sm text-slate-400">
            Update ownership and lifecycle state. Every change is recorded.
          </p>
          <div className="mt-6">
            <IncidentControls
              key={`${incident.status}:${incident.team?.id ?? "unassigned"}`}
              incidentId={incident.id}
              status={incident.status}
              teamId={incident.team?.id ?? null}
              teams={teams}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
