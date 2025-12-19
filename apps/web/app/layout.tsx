import type { Metadata } from "next";
import Link from "next/link";

import { AuthNav } from "@/components/AuthNav";
import { ConfirmProvider } from "@/components/ConfirmDialog";

import "./globals.css";

export const metadata: Metadata = {
  title: "GoEducate Talent",
  description: "High School Football Talent Evaluation Platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <ConfirmProvider>
          <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                GoEducate Talent
              </Link>
              <AuthNav />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
          <footer className="border-t border-slate-800 py-10 text-center text-sm text-slate-400">
            © {new Date().getFullYear()} GoEducate
          </footer>
        </ConfirmProvider>
      </body>
    </html>
  );
}



