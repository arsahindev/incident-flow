import Link from "next/link";

import { logoutAction, switchOrganizationAction } from "../auth-actions";
import { getOptionalSession, getOrganizations } from "@/lib/api";

export async function AppHeader() {
  const session = await getOptionalSession();
  const organizations = session ? (await getOrganizations()).organizations : [];

  return (
    <header className="border-b border-slate-800 bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-8">
          <Link href="/" className="group">
            <p className="text-lg font-semibold tracking-tight group-hover:text-cyan-300">
              IncidentFlow
            </p>
            <p className="text-sm text-slate-400">
              {session?.organizationName ?? "Incident response coordination"}
            </p>
          </Link>

          {session && (
            <nav className="flex gap-4 text-sm text-slate-300" aria-label="Primary navigation">
              <Link href="/" className="hover:text-cyan-300">Incidents</Link>
              <Link href="/services" className="hover:text-cyan-300">Services</Link>
              {session.permissions.includes("members.manage") && (
                <Link href="/settings/members" className="hover:text-cyan-300">Members</Link>
              )}
            </nav>
          )}
        </div>

        {session && (
          <div className="flex items-center gap-3">
            {organizations.length > 1 && (
              <form action={switchOrganizationAction} className="flex items-center gap-2">
                <label htmlFor="organization-switcher" className="sr-only">Organization</label>
                <select
                  id="organization-switcher"
                  name="organizationSlug"
                  defaultValue={session.organizationSlug}
                  className="max-w-48 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.slug}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <button className="text-xs text-cyan-300 hover:text-cyan-200">Switch</button>
              </form>
            )}

            <div className="hidden text-right text-xs sm:block">
              <p className="font-medium text-slate-200">{session.displayName}</p>
              <p className="text-slate-500">{session.role}</p>
            </div>
            <form action={logoutAction}>
              <button className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-red-500/50 hover:text-red-200">Sign out</button>
            </form>
          </div>
        )}
        {!session && <Link href="/login" className="text-sm text-cyan-300">Sign in</Link>}
      </div>
    </header>
  );
}
