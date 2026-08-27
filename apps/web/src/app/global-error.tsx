"use client";

import { useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  const handleRetry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-red-400">
          Unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Application could not start
        </h1>
        <p className="mt-3 max-w-md text-slate-400">
          The root layout failed to load. Please ensure the database and API services are online.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-6 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Try again
        </button>
      </body>
    </html>
  );
}