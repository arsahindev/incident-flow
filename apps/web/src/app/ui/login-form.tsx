"use client";

import { useActionState } from "react";

import { loginAction, type AuthFormState } from "../auth-actions";

const initialState: AuthFormState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm text-slate-300">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
        />
      </label>
      <label className="block text-sm text-slate-300">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
