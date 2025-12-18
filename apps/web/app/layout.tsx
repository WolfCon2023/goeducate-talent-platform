import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "GoEducate Talent",
  description: "High School Football Talent Evaluation Platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              GoEducate Talent
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-200">
              <Link href="/player" className="hover:text-white">
                Player
              </Link>
              <Link href="/coach" className="hover:text-white">
                Coach
              </Link>
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-white px-3 py-1.5 text-slate-900 hover:bg-slate-200"
              >
                Create account
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        <footer className="border-t border-slate-800 py-10 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} GoEducate
        </footer>
      </body>
    </html>
  );
}



