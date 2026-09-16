import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import {
  archiveServiceAction,
  archiveServiceEnvironmentAction,
} from "@/app/actions";
import { ApiError, getService, getTeams, requireSession } from "@/lib/api";

import { PriorityBadge, StatusBadge } from "../../ui/badges";
import { CreateEnvironmentForm } from "../../ui/create-environment-form";
import { ServiceSettingsForm } from "../../ui/service-settings-form";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  await connection();
  const session = await requireSession();
  const { serviceId } = await params;
  const { updated } = await searchParams;
  let service;
  try {
    ({ service } = await getService(serviceId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { teams } = await getTeams();
  const archiveAction = archiveServiceAction.bind(null, service.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/services" className="text-sm text-cyan-300">
        ← Back to services
      </Link>
      {updated === "1" ? (
        <p
          role="status"
          className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          Service settings updated.
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
            {service.type} · {service.tier} tier
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{service.name}</h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            {service.description || "No description provided."}
          </p>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>Status: {service.status}</p>
          <p className="mt-1">
            Owner: {service.ownerTeam?.name ?? "Unassigned"}
          </p>
        </div>
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="font-semibold">Environments</h2>
            </div>
            <ul className="divide-y divide-slate-800">
              {service.environments.map((environment) => {
                const archiveAction = archiveServiceEnvironmentAction.bind(
                  null,
                  service.id,
                  environment.id,
                );
                return (
                  <li
                    key={environment.id}
                    className="flex items-center justify-between gap-4 px-6 py-5"
                  >
                    <div>
                      <p className="font-medium">{environment.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {environment.kind}
                        {environment.isEphemeral ? " · ephemeral" : ""} ·{" "}
                        {environment.status}
                      </p>
                    </div>
                    {environment.status === "active" &&
                    session.permissions.includes("services.manage") ? (
                      <form action={archiveAction}>
                        <button className="text-sm text-slate-400 hover:text-red-300">
                          Archive
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="font-semibold">Incident history</h2>
            </div>
            {service.recentIncidents.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400">
                No incidents have affected this service.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {service.recentIncidents.map((incident) => (
                  <li key={incident.id}>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-slate-800/50"
                    >
                      <div>
                        <p className="font-medium">{incident.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(incident.createdAt)}
                          {incident.isPrimary ? " · primary service" : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <PriorityBadge priority={incident.priority} />
                        <StatusBadge status={incident.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        {session.permissions.includes("services.manage") ? (
          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Service settings</h2>
              <div className="mt-6">
                <ServiceSettingsForm service={service} teams={teams} />
              </div>
            </section>
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Add environment</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create a stable or ephemeral deployment context for this
                service.
              </p>
              <div className="mt-6">
                <CreateEnvironmentForm serviceId={service.id} />
              </div>
            </section>
            <section className="rounded-xl border border-red-900/50 bg-slate-900 p-5">
              <h2 className="font-semibold text-red-200">Archive service</h2>
              <p className="mt-1 text-sm text-slate-400">
                Archived services cannot be selected for new incidents.
              </p>
              <form action={archiveAction} className="mt-4">
                <button className="w-full rounded-lg border border-red-700/60 px-4 py-2 text-sm text-red-200">
                  Archive service
                </button>
              </form>
            </section>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
