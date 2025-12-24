import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AuthNav } from "@/components/AuthNav";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/ToastProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "GoEducate Talent",
  description: "GoEducate Athletics Talent Evaluation Platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
            <header className="sticky top-0 z-50 border-b border-[color:var(--color-border)] bg-[color:var(--color-panel)]/80 backdrop-blur print:hidden">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
                <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
                  <Image src="/logo.png" alt="GoEducate Talent" width={28} height={28} className="h-7 w-7" priority />
                  <span className="print:hidden">GoEducate Talent</span>
                  <span className="hidden print:inline">GoEd Talent</span>
                </Link>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <AuthNav />
                </div>
              </div>
            </header>
            <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-8">{children}</main>
            <footer className="border-t border-[color:var(--color-border)] py-10 text-sm text-[color:var(--color-text-muted)] print:hidden">
              <div className="mx-auto grid max-w-7xl gap-3 px-6 sm:grid-cols-3 sm:items-center sm:px-8">
                <div>© 2025 GoEducate, Inc. All rights reserved.</div>
                <div className="sm:text-center">
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                    <a href="/contact" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                      Contact
                    </a>
                    <a href="/about" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                      About
                    </a>
                    <a href="/legal/eula" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                      EULA
                    </a>
                    <a href="/legal/terms" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                      Terms
                    </a>
                    <a href="/legal/privacy" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                      Privacy
                    </a>
                  </div>
                </div>
                <div className="sm:text-right">Built by Wolf Consulting Group, LLC.</div>
              </div>
            </footer>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}



