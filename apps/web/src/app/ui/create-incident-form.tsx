"use client";

import { useActionState } from "react";

import { createIncidentAction } from "@/app/actions";
import { initialIncidentFormState } from "@/app/form-state";
import type { Team } from "@/lib/types";

export function CreateIncidentForm({ teams }: { teams: Team[] }) {
  const [state, formAction, pending] = useActionState(
    createIncidentAction,
    initialIncidentFormState,
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
