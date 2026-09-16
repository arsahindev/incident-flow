"use client";

import { useActionState } from "react";

import { createServiceAction } from "@/app/actions";
import { initialIncidentFormState } from "@/app/form-state";
import type { Team } from "@/lib/types";

export function CreateServiceForm({ teams }: { teams: Team[] }) {
  const [state, formAction, pending] = useActionState(
    createServiceAction,
    initialIncidentFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="name" className="text-sm font-medium text-slate-200">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Checkout API"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        />
      </div>
      <div>
        <label htmlFor="slug" className="text-sm font-medium text-slate-200">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="Generated from the name"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        />
      </div>
      <div>
        <label
          htmlFor="description"
          className="text-sm font-medium text-slate-200"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Type
          <select
            name="type"
            defaultValue="api"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
          >
            {[
              "application",
              "api",
              "platform",
              "infrastructure",
              "business",
              "external",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Tier
          <select
            name="tier"
            defaultValue="medium"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
          >
            {["critical", "high", "medium", "low"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm text-slate-300">
        Owning team
        <select
          name="ownerTeamId"
          defaultValue=""
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
        >
          <option value="">No owner yet</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-slate-200">
          Initial environments
        </legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-300">
          {["development", "staging", "production"].map((environment) => (
            <label key={environment} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="environments"
                value={environment}
                defaultChecked={environment === "production"}
              />
              {environment}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {pending ? "Creating service…" : "Create service"}
      </button>
    </form>
  );
}
