import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ApiError, getInvitation } from "@/lib/api";

import { AcceptInvitationForm } from "../../ui/accept-invitation-form";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let invitation;
  try {
    ({ invitation } = await getInvitation(token));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-lg items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">Invitation</p>
        <h1 className="mt-2 text-3xl font-semibold">Join {invitation.organizationName}</h1>
        <p className="mt-3 text-slate-400">Invited as {invitation.email} with the {invitation.role} role.</p>
        <div className="mt-8"><AcceptInvitationForm token={token} /></div>
      </section>
    </main>
  );
}
