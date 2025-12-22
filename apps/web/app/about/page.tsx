import Link from "next/link";

import { PublicShell } from "@/components/PublicShell";

export default function AboutPage() {
  return (
    <PublicShell title="About GoEducate Talent">
      <div className="grid gap-4 text-sm text-white/80">
        <p>
          GoEducate Talent helps student-athletes share film, receive evaluations, and connect with coaches through a secure,
          role-based platform.
        </p>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Legal</div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/legal/eula">
              EULA
            </Link>
            <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/legal/terms">
              Terms
            </Link>
            <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/legal/privacy">
              Privacy
            </Link>
          </div>
        </div>

        <div className="pt-2">
          <Link href="/" className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Back to Home
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}


