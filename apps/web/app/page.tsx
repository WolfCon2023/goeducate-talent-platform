import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid gap-10">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-10">
        <div className="max-w-3xl">
          <span className="eyebrow">GoEducate High School Football</span>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Film to feedback, faster.
          </h1>
          <p className="mt-4 text-lg text-white/90">
            Players upload game film and receive professional evaluations. Coaches discover and evaluate talent with
            powerful search.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/request-access" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Request access
            </Link>
            <Link
              href="/coach"
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Coach dashboard (MVP)
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold">Players</h2>
          <p className="mt-2 text-sm text-white/80">Build your profile, upload film, and track evaluation status.</p>
        </div>
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold">Coaches</h2>
          <p className="mt-2 text-sm text-white/80">
            Search by position, year, and location. Watchlists and subscription gating later.
          </p>
        </div>
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold">Evaluators</h2>
          <p className="mt-2 text-sm text-white/80">Evaluation queue and tagged plays will follow in the next slice.</p>
        </div>
      </section>
    </div>
  );
}



