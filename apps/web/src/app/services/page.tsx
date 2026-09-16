import Link from "next/link";
import { connection } from "next/server";

import { getServices, getTeams, requireSession } from "@/lib/api";

import { CreateServiceForm } from "../ui/create-service-form";

export default async function ServicesPage() {
  await connection();
  const session = await requireSession();
  const [{ services }, { teams }] = await Promise.all([
    getServices(),
    getTeams(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">
        Service catalog
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        What the organization operates
      </h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Model applications, platforms, infrastructure, business capabilities,
        and external dependencies.
      </p>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-100">
                    {service.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {service.type} · {service.tier} tier
                  </p>
                </div>
                <span className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300">
                  {service.status}
                </span>
              </div>
              <p className="mt-4 line-clamp-2 text-sm text-slate-400">
                {service.description || "No description"}
              </p>
              <div className="mt-5 flex justify-between text-xs text-slate-500">
                <span>
                  {
                    service.environments.filter(
                      (environment) => environment.status === "active",
                    ).length
                  }{" "}
                  {service.environments.filter(
                    (environment) => environment.status === "active",
                  ).length === 1
                    ? "environment"
                    : "environments"}
                </span>
                <span>{service.incidentCount} incidents</span>
              </div>
            </Link>
          ))}
          {services.length === 0 ? (
            <p className="text-slate-400">No services yet.</p>
          ) : null}
        </section>
        {session.permissions.includes("services.manage") ? (
          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Create service</h2>
            <p className="mt-1 text-sm text-slate-400">
              Add an operational capability and its initial environments.
            </p>
            <div className="mt-6">
              <CreateServiceForm teams={teams} />
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
