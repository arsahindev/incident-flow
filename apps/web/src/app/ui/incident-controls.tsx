"use client";

import { useActionState, useState } from "react";

import { updateIncidentAction } from "@/app/actions";
import { initialIncidentFormState } from "@/app/form-state";
import type { IncidentStatus, Service, Team } from "@/lib/types";

export function IncidentControls({
  incidentId,
  status,
  teamId,
  teams,
  services,
  selectedServiceIds,
  primaryServiceId,
}: {
  incidentId: string;
  status: IncidentStatus;
  teamId: string | null;
  teams: Team[];
  services: Service[];
  selectedServiceIds: string[];
  primaryServiceId: string | null;
}) {
  const updateAction = updateIncidentAction.bind(null, incidentId);
  const [state, formAction, pending] = useActionState(
    updateAction,
    initialIncidentFormState,
  );
  const [currentServiceIds, setCurrentServiceIds] = useState(selectedServiceIds);
  const [currentPrimaryServiceId, setCurrentPrimaryServiceId] = useState(
    primaryServiceId ?? "",
  );
  const selectedServices = services.filter((service) =>
    currentServiceIds.includes(service.id),
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="status" className="text-sm font-medium text-slate-200">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        >
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
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
          value={currentServiceIds}
          onChange={(event) => {
            const nextServiceIds = Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value,
            );
            setCurrentServiceIds(nextServiceIds);
            if (!nextServiceIds.includes(currentPrimaryServiceId)) {
              setCurrentPrimaryServiceId("");
            }
          }}
          size={Math.min(Math.max(services.length, 3), 6)}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
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
          value={currentPrimaryServiceId}
          onChange={(event) => setCurrentPrimaryServiceId(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        >
          <option value="">Use the first affected service</option>
          {selectedServices.map((service) => (
            <option key={service.id} value={service.id}>{service.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Only services selected above can be made primary.
        </p>
      </div>
      <div>
        <label htmlFor="teamId" className="text-sm font-medium text-slate-200">
          Assigned team
        </label>
        <select
          id="teamId"
          name="teamId"
          defaultValue={teamId ?? ""}
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

      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
