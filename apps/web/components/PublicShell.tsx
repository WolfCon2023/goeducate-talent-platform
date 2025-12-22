import Image from "next/image";
import Link from "next/link";

export function PublicShell(props: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <Image src="/logo.png" alt="GoEducate Talent" width={28} height={28} className="h-7 w-7" priority />
          <span>GoEducate Talent</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-white/90 hover:bg-white/10">
            Home
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-6">
        {props.title ? <h1 className="text-balance text-3xl font-semibold tracking-tight">{props.title}</h1> : null}
        <div className={props.title ? "mt-4" : ""}>{props.children}</div>
      </div>

      <footer className="text-xs text-[color:var(--muted-2)]">
        © 2025 GoEducate, Inc. ·{" "}
        <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/about">
          About
        </Link>{" "}
        ·{" "}
        <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/legal/terms">
          Terms
        </Link>{" "}
        ·{" "}
        <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/legal/privacy">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/legal/eula">
          EULA
        </Link>
      </footer>
    </div>
  );
}


