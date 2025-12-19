"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken, getTokenRole } from "@/lib/auth";

function roleToDashboard(role: string | null) {
  if (role === "player") return "/player";
  if (role === "coach") return "/coach";
  if (role === "evaluator") return "/evaluator";
  if (role === "admin") return "/admin";
  return "/";
}

export function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const tokenRole = getTokenRole(token);
    setRole(tokenRole);
    setDisplayName(null);

    async function loadMe() {
      if (!token) return;
      try {
        const res = await apiFetch<{ user: { role: string; displayName: string } }>("/auth/me", { token });
        setRole(res.user.role);
        setDisplayName(res.user.displayName);
      } catch {
        // Token is invalid/expired: log out locally
        clearAccessToken();
        setRole(null);
        setDisplayName(null);
      }
    }

    void loadMe();
  }, [pathname]);

  const dashboardHref = useMemo(() => roleToDashboard(role), [role]);

  function navItem(href: string) {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return `rounded-md px-2.5 py-1.5 text-sm ${
      active ? "bg-[var(--surface-soft)] text-[color:var(--foreground)]" : "text-[color:var(--muted)] hover:bg-[var(--surface-soft)]"
    }`;
  }

  function logout() {
    clearAccessToken();
    setRole(null);
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-2 text-sm">
      <Link href="/player" className={navItem("/player")}>
        Player
      </Link>
      <Link href="/coach" className={navItem("/coach")}>
        Coach
      </Link>

      {role ? (
        <>
          <Link href={dashboardHref} className={navItem(dashboardHref)}>
            Dashboard
          </Link>
          <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-2)]">
            {role}
            {displayName ? ` · ${displayName}` : ""}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className={navItem("/login")}>
            Login
          </Link>
          <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            Create account
          </Link>
        </>
      )}
    </nav>
  );
}


