import Link from "next/link";
import { connection } from "next/server";

import { getIncidents, getServices, getTeams, requireSession } from "@/lib/api";
import type { IncidentPriority, IncidentStatus } from "@/lib/types";

import { PriorityBadge, StatusBadge } from "./ui/badges";
import { CreateIncidentForm } from "./ui/create-incident-form";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const statuses = ["open", "acknowledged", "resolved"] as const;
const priorities = ["low", "medium", "high", "critical"] as const;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const session = await requireSession();
  const search = await searchParams;
  const serviceId = one(search.serviceId);
  const teamId = one(search.teamId);
  const requestedStatus = one(search.status);
  const requestedPriority = one(search.priority);
  const status = statuses.includes(requestedStatus as IncidentStatus)
    ? (requestedStatus as IncidentStatus)
    : undefined;
  const priority = priorities.includes(requestedPriority as IncidentPriority)
    ? (requestedPriority as IncidentPriority)
    : undefined;
  const requestedPage = Number(one(search.page) ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [{ incidents, pagination }, { teams }, { services }] = await Promise.all([
    getIncidents({ serviceId, teamId, status, priority, page }),
    getTeams(),
    getServices(),
  ]);
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
          ["Matching incidents", pagination.total, "Across the selected filters"],
          ["Open on this page", openCount, "Awaiting acknowledgement"],
          ["Acknowledged on this page", acknowledgedCount, `${resolvedCount} resolved`],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <form
        method="get"
        className="mt-8 grid gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-4"
      >
        <label className="text-sm text-slate-300">
          Service
          <select name="serviceId" defaultValue={serviceId ?? ""} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="">All services</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Team
          <select name="teamId" defaultValue={teamId ?? ""} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="">All teams</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Status
          <select name="status" defaultValue={status ?? ""} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Priority
          <select name="priority" defaultValue={priority ?? ""} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="">All priorities</option>
            {priorities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div className="flex gap-3 md:col-span-4">
          <button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Apply filters</button>
          <Link href="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Reset</Link>
        </div>
      </form>

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
                        <p className="mt-2 text-xs text-slate-500">
                          {incident.affectedServices.length > 0
                            ? incident.affectedServices
                                .map((service) => service.name)
                                .join(" · ")
                            : "Affected services not yet classified"}
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
          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4 text-sm">
              <span className="text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
              <div className="flex gap-2">
                {pagination.page > 1 ? <Link href={{ query: { ...Object.fromEntries(Object.entries(search).filter(([, value]) => typeof value === "string")), page: pagination.page - 1 } }} className="rounded border border-slate-700 px-3 py-1.5">Previous</Link> : null}
                {pagination.page < pagination.totalPages ? <Link href={{ query: { ...Object.fromEntries(Object.entries(search).filter(([, value]) => typeof value === "string")), page: pagination.page + 1 } }} className="rounded border border-slate-700 px-3 py-1.5">Next</Link> : null}
              </div>
            </div>
          ) : null}
        </section>

        {session.permissions.includes("incidents.manage") ? (
          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Create incident</h2>
            <p className="mt-1 text-sm text-slate-400">
              Record a service-impacting event for your team.
            </p>
            <div className="mt-6">
              <CreateIncidentForm teams={teams} services={services} />
            </div>
          </aside>
        ) : (
          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
            Your viewer role provides read-only incident access.
          </aside>
        )}
      </div>
    </main>
  );
}
