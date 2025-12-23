import Link from "next/link";

import { Card } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <h1 className="text-balance text-3xl font-semibold tracking-tight">GoEducate Talent</h1>
        <p className="mt-3 text-white/80">
          Welcome. Please sign in to access your dashboard, showcases, and registrations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Login
          </Link>
          <Link
            href="/request-access"
            className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
          >
            Request access
          </Link>
          <Link href="/about" className="px-2 py-2 text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            About
          </Link>
        </div>
      </Card>
    </div>
  );
}


