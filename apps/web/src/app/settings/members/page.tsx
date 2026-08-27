import { notFound } from "next/navigation";
import { connection } from "next/server";

import { updateTeamMembershipAction } from "@/app/auth-actions";
import { getMembers, getTeams, requireSession } from "@/lib/api";

import { InvitationForm } from "../../ui/invitation-form";
import { MemberSettingsForm } from "../../ui/member-settings-form";

export default async function MembersPage() {
  await connection();
  const session = await requireSession();
  if (!session.permissions.includes("members.manage")) notFound();
  const [{ members }, { teams }] = await Promise.all([getMembers(), getTeams()]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold">Members and access</h1>
        <p className="mt-2 text-slate-400">Manage organization roles, access state, and team membership.</p>
      </div>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-4"><h2 className="font-semibold">Organization members</h2></div>
          <ul className="divide-y divide-slate-800">
            {members.map((member) => (
              <li key={member.userId} className="space-y-5 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{member.displayName}</p>
                    <p className="mt-1 text-sm text-slate-400">{member.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Teams: {member.teams.map((team) => team.name).join(", ") || "None"}</p>
                  </div>
                  <MemberSettingsForm member={member} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => {
                    const assigned = member.teams.some((candidate) => candidate.id === team.id);
                    const action = updateTeamMembershipAction.bind(null, team.id, member.userId, !assigned);
                    return (
                      <form action={action} key={team.id}>
                        <button className={`rounded-full border px-3 py-1 text-xs ${assigned ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>
                          {assigned ? `Remove ${team.name}` : `Add ${team.name}`}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold">Invite a member</h2>
          <p className="mt-1 text-sm text-slate-400">Invitation secrets are stored only as hashes and expire after 48 hours.</p>
          <div className="mt-6"><InvitationForm /></div>
        </aside>
      </div>
    </main>
  );
}
