import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid gap-10">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-slate-300">GoEducate High School Football</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Film to feedback, faster.
          </h1>
          <p className="mt-4 text-lg text-slate-200">
            Players upload game film and receive professional evaluations. Coaches discover and evaluate talent with
            powerful search.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900">
              Create a free player account
            </Link>
            <Link
              href="/coach"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Coach dashboard (MVP)
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-base font-semibold">Players</h2>
          <p className="mt-2 text-sm text-slate-300">Build your profile, upload film, and track evaluation status.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-base font-semibold">Coaches</h2>
          <p className="mt-2 text-sm text-slate-300">
            Search by position, year, and location. Watchlists and subscription gating later.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-base font-semibold">Evaluators</h2>
          <p className="mt-2 text-sm text-slate-300">Evaluation queue and tagged plays will follow in the next slice.</p>
        </div>
      </section>
    </div>
  );
}


