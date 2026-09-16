import { connection } from "next/server";
import { publicDemoAccount } from "@incidentflow/contracts";

import { LoginForm } from "../ui/login-form";
import { getServerEnvironment } from "../../lib/env/server";

export default async function LoginPage() {
  await connection();
  const demoEnvironment = getServerEnvironment().PUBLIC_DEMO_ENVIRONMENT;
  const demo = demoEnvironment ? publicDemoAccount(demoEnvironment) : undefined;
  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">
          Secure access
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Sign in to IncidentFlow</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sessions are stored server-side and can be revoked immediately.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
        {demo && (
          <aside
            className="mt-6 space-y-3 rounded-lg border border-cyan-900 bg-slate-950 p-4 text-sm text-slate-300"
            aria-label="Public demo access"
          >
            <h2 className="font-semibold text-cyan-400">
              Try the {demoEnvironment} demo
            </h2>
            <p>
              Explore incidents with a shared responder account. Changes are
              visible to other visitors. Please use fictional data.
            </p>
            <dl className="space-y-2 text-xs">
              <div>
                <dt>Email</dt>
                <dd className="break-all">
                  <code>{demo.email}</code>
                </dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd className="break-all">
                  <code>{demo.password}</code>
                </dd>
              </div>
            </dl>
          </aside>
        )}
      </section>
    </main>
  );
}
