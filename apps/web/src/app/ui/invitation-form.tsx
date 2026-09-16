"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createInvitationAction,
  type InvitationFormState,
} from "../auth-actions";

const initialState: InvitationFormState = { error: null, invitationUrl: null };

export function InvitationForm() {
  const [state, action, pending] = useActionState(
    createInvitationAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm text-slate-300">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="off"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
        />
      </label>
      <label className="block text-sm text-slate-300">
        Role
        <select
          name="role"
          defaultValue="responder"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
        >
          <option value="admin">Admin</option>
          <option value="responder">Responder</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.invitationUrl ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <p>Invitation created. Share this one-time link:</p>
          <Link
            href={state.invitationUrl}
            className="mt-2 block break-all font-mono text-xs underline"
          >
            {state.invitationUrl}
          </Link>
        </div>
      ) : null}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create invitation"}
      </button>
    </form>
  );
}
