import Link from "next/link";

import { Card } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.45)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_30%_10%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(700px_circle_at_80%_70%,rgba(16,185,129,0.16),transparent_55%)]"
        />

        <div className="relative p-8 md:p-12">
          <div className="max-w-3xl">
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">GoEducate Talent</h1>
            <p className="mt-4 text-base text-white/80 md:text-lg">
              An invite-based platform connecting <span className="text-white">players</span>,{" "}
              <span className="text-white">coaches</span>, and <span className="text-white">evaluators</span> through film
              submissions and structured evaluation reports.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Sign in
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

            <div className="mt-6 text-xs text-white/60">
              Invite-based access keeps the ecosystem trusted and professional. If you don’t have an invite, request
              access and select your role.
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Card className="bg-white/5">
              <div className="text-sm font-semibold text-white">Players</div>
              <div className="mt-2 text-sm text-white/80">
                Submit film, track review status, and view your evaluation report when it’s completed.
              </div>
            </Card>
            <Card className="bg-white/5">
              <div className="text-sm font-semibold text-white">Coaches</div>
              <div className="mt-2 text-sm text-white/80">
                Search players, review film and evaluations, and manage subscription billing inside your dashboard.
              </div>
            </Card>
            <Card className="bg-white/5">
              <div className="text-sm font-semibold text-white">Evaluators</div>
              <div className="mt-2 text-sm text-white/80">
                Review assigned film and publish consistent, constructive evaluations using a structured rubric.
              </div>
            </Card>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card className="bg-white/5">
              <div className="text-sm font-semibold text-white">How to join</div>
              <ol className="mt-3 list-decimal pl-5 text-sm text-white/80">
                <li>Request access and choose your role (Player, Coach, or Evaluator).</li>
                <li>Sign in once approved (invite-based).</li>
                <li>Use your dashboard to submit film, evaluate, or discover players.</li>
              </ol>
            </Card>
            <Card className="bg-white/5">
              <div className="text-sm font-semibold text-white">Learn more</div>
              <div className="mt-2 text-sm text-white/80">
                Want the full overview and role-by-role steps? Visit the GoEducate website page for the platform.
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="https://www.goeducateinc.org/talent"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                >
                  GoEducateInc.org /talent
                </a>
                <a
                  href="https://www.goeducateinc.org"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-2 text-sm text-indigo-300 hover:text-indigo-200 hover:underline"
                >
                  Main site →
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


