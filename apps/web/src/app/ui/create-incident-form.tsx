"use client";

import { useActionState, useState } from "react";

import { createIncidentAction } from "@/app/actions";
import { initialIncidentFormState } from "@/app/form-state";
import type { Service, Team } from "@/lib/types";

export function CreateIncidentForm({
  teams,
  services,
}: {
  teams: Team[];
  services: Service[];
}) {
  const [state, formAction, pending] = useActionState(
    createIncidentAction,
    initialIncidentFormState,
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [primaryServiceId, setPrimaryServiceId] = useState("");
  const selectedServices = services.filter((service) =>
    selectedServiceIds.includes(service.id),
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="title" className="text-sm font-medium text-slate-200">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={160}
          placeholder="Checkout API is returning 503 errors"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400"
        />
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium text-slate-200">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={5000}
          placeholder="What is happening and which users or systems are affected?"
          className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="priority" className="text-sm font-medium text-slate-200">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue="medium"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label htmlFor="teamId" className="text-sm font-medium text-slate-200">
            Assigned team
          </label>
          <select
            id="teamId"
            name="teamId"
            defaultValue=""
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
          >
            <option value="">Unassigned</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="serviceIds" className="text-sm font-medium text-slate-200">
          Affected services
        </label>
        <select
          id="serviceIds"
          name="serviceIds"
          multiple
          required
          value={selectedServiceIds}
          onChange={(event) => {
            const nextServiceIds = Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value,
            );
            setSelectedServiceIds(nextServiceIds);
            if (!nextServiceIds.includes(primaryServiceId)) {
              setPrimaryServiceId("");
            }
          }}
          size={Math.min(Math.max(services.length, 3), 6)}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} · {service.tier}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Select one or more services.
        </p>
      </div>

      <div>
        <label htmlFor="primaryServiceId" className="text-sm font-medium text-slate-200">
          Primary service
        </label>
        <select
          id="primaryServiceId"
          name="primaryServiceId"
          value={primaryServiceId}
          onChange={(event) => setPrimaryServiceId(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        >
          <option value="">Use the first affected service</option>
          {selectedServices.map((service) => (
            <option key={service.id} value={service.id}>{service.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Only selected affected services are available here.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Creating incident…" : "Create incident"}
      </button>
    </form>
  );
}
