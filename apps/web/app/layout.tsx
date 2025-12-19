import type { Metadata } from "next";
import Image from "next/image";
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
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <ConfirmProvider>
          <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
              <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
                <Image src="/logo.png" alt="GoEducate Talent" width={28} height={28} className="h-7 w-7" priority />
                <span>GoEducate Talent</span>
              </Link>
              <AuthNav />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8">{children}</main>
          <footer className="border-t border-white/10 py-10 text-center text-sm text-white/60">
            © {new Date().getFullYear()} GoEducate
          </footer>
        </ConfirmProvider>
      </body>
    </html>
  );
}



