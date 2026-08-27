import { connection } from "next/server";

import { LoginForm } from "../ui/login-form";

export default async function LoginPage() {
  await connection();
  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-400">Secure access</p>
        <h1 className="mt-2 text-3xl font-semibold">Sign in to IncidentFlow</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sessions are stored server-side and can be revoked immediately.
        </p>
        <div className="mt-8"><LoginForm /></div>
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
          <p>Seeded local password: <code className="text-slate-200">IncidentFlow-Dev-2026!</code></p>
        </div>
      </section>
    </main>
  );
}
