"use client";

import { useActionState } from "react";

import { type AuthFormState, updateMemberAction } from "../auth-actions";
import type { OrganizationMember } from "@/lib/types";

export function MemberSettingsForm({ member }: { member: OrganizationMember }) {
  const action = updateMemberAction.bind(null, member.userId);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    {
      error: null,
    },
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-400">
        Role
        <select
          name="role"
          defaultValue={member.role}
          className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="responder">Responder</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Access
        <select
          name="status"
          defaultValue={member.membershipStatus}
          className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
      <button
        disabled={pending}
        className="rounded border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error ? (
        <p role="alert" className="basis-full text-xs text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
