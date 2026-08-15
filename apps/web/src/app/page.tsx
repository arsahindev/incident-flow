import Link from "next/link";
import { connection } from "next/server";

import { getIncidents, getTeams } from "@/lib/api";

import { PriorityBadge, StatusBadge } from "./ui/badges";
import { CreateIncidentForm } from "./ui/create-incident-form";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function Home() {
  await connection();
  const [{ incidents }, { teams }] = await Promise.all([getIncidents(), getTeams()]);
  const openCount = incidents.filter((incident) => incident.status === "open").length;
  const acknowledgedCount = incidents.filter(
    (incident) => incident.status === "acknowledged",
  ).length;
  const resolvedCount = incidents.filter(
    (incident) => incident.status === "resolved",
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">
          Operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Incident dashboard</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Create incidents, coordinate ownership, and follow every lifecycle change.
        </p>
      </div>

      <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Incident summary">
        {[
          ["Open incidents", openCount, "Awaiting acknowledgement"],
          ["Acknowledged", acknowledgedCount, "Response is in progress"],
          ["Resolved", resolvedCount, "Closed incidents"],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold">Recent incidents</h2>
          </div>
          {incidents.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full border border-slate-700 bg-slate-800 p-3 text-xl" aria-hidden="true">
                ✓
              </div>
              <p className="mt-4 font-medium">No incidents yet</p>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                Create the first incident to exercise the persisted lifecycle and activity timeline.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {incidents.map((incident) => (
                <li key={incident.id}>
                  <Link
                    href={`/incidents/${incident.id}`}
                    className="block px-5 py-5 transition hover:bg-slate-800/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-slate-100">{incident.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {incident.team?.name ?? "Unassigned"} · {formatDate(incident.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <PriorityBadge priority={incident.priority} />
                        <StatusBadge status={incident.status} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold">Create incident</h2>
          <p className="mt-1 text-sm text-slate-400">
            Record a service-impacting event for your team.
          </p>
          <div className="mt-6">
            <CreateIncidentForm teams={teams} />
          </div>
        </aside>
      </div>
    </main>
  );
}
