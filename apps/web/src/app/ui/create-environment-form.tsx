"use client";

import { useActionState, useState } from "react";

import { createServiceEnvironmentAction } from "@/app/actions";
import { initialIncidentFormState } from "@/app/form-state";

export function CreateEnvironmentForm({ serviceId }: { serviceId: string }) {
  const action = createServiceEnvironmentAction.bind(null, serviceId);
  const [state, formAction, pending] = useActionState(action, initialIncidentFormState);
  const [isEphemeral, setIsEphemeral] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm text-slate-300">Name
        <input name="name" required minLength={2} maxLength={100} placeholder="Preview PR 417" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5" />
      </label>
      <label className="block text-sm text-slate-300">Kind
        <select name="kind" defaultValue="preview" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
          {['development', 'test', 'staging', 'production', 'preview', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          name="isEphemeral"
          checked={isEphemeral}
          onChange={(event) => setIsEphemeral(event.target.checked)}
        /> Ephemeral environment
      </label>
      <label className="block text-sm text-slate-300">Expires at (optional)
        <input
          type="datetime-local"
          name="expiresAt"
          disabled={!isEphemeral}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </label>
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}
      <button disabled={pending} className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 disabled:opacity-60">
        {pending ? "Adding…" : "Add environment"}
      </button>
    </form>
  );
}
