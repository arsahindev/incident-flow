import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "./ui/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "IncidentFlow",
  description: "Incident intake, routing, and response coordination.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-950 text-slate-100">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
