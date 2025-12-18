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

  function logout() {
    clearAccessToken();
    setRole(null);
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-4 text-sm text-slate-200">
      <Link href="/player" className="hover:text-white">
        Player
      </Link>
      <Link href="/coach" className="hover:text-white">
        Coach
      </Link>

      {role ? (
        <>
          <Link href={dashboardHref} className="hover:text-white">
            Dashboard
          </Link>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-200">
            {role}
            {displayName ? ` · ${displayName}` : ""}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="hover:text-white">
            Login
          </Link>
          <Link href="/register" className="rounded-md bg-white px-3 py-1.5 text-slate-900 hover:bg-slate-200">
            Create account
          </Link>
        </>
      )}
    </nav>
  );
}


