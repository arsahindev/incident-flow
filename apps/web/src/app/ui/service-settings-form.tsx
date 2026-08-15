"use client";

import { useActionState } from "react";

import { updateServiceAction } from "@/app/actions";
import { initialIncidentFormState } from "@/app/form-state";
import type { Service, Team } from "@/lib/types";

export function ServiceSettingsForm({ service, teams }: { service: Service; teams: Team[] }) {
  const action = updateServiceAction.bind(null, service.id);
  const [state, formAction, pending] = useActionState(action, initialIncidentFormState);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm text-slate-300">Status
        <select name="status" defaultValue={service.status} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
          {['operational', 'degraded', 'disrupted', 'maintenance'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block text-sm text-slate-300">Tier
        <select name="tier" defaultValue={service.tier} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
          {['critical', 'high', 'medium', 'low'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block text-sm text-slate-300">Owning team
        <select name="ownerTeamId" defaultValue={service.ownerTeam?.id ?? ""} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
          <option value="">No owner</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}
      <button disabled={pending} className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 disabled:opacity-60">
        {pending ? "Saving…" : "Save service"}
      </button>
    </form>
  );
}
