"use client";

import { useActionState } from "react";

import { acceptInvitationAction, type AuthFormState } from "../auth-actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const action = acceptInvitationAction.bind(null, token);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {
    error: null,
  });
  return (
    <form action={formAction} className="space-y-5">
      <label className="block text-sm text-slate-300">Display name
        <input name="displayName" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5" />
      </label>
      <label className="block text-sm text-slate-300">Password
        <input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5" />
      </label>
      <p className="text-xs leading-5 text-slate-500">Use at least 12 characters with uppercase, lowercase, number, and symbol.</p>
      {state.error ? <p role="alert" className="text-sm text-red-300">{state.error}</p> : null}
      <button disabled={pending} className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-60">
        {pending ? "Joining…" : "Accept invitation"}
      </button>
    </form>
  );
}
