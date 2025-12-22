"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken, getTokenRole } from "@/lib/auth";
import { ImageLightbox } from "@/components/ImageLightbox";

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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoBust, setProfilePhotoBust] = useState<number>(0);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const token = getAccessToken();
    const tokenRole = getTokenRole(token);
    setRole(tokenRole);
    setDisplayName(null);
    setProfilePhotoUrl(null);
    setUnreadCount(0);
    let interval: number | null = null;
    let cancelled = false;

    async function refreshUnread(t: string) {
      const unread = await apiFetch<{ count: number }>("/notifications/unread-count", { token: t }).catch(() => ({ count: 0 }));
      if (!cancelled) setUnreadCount(unread.count ?? 0);
    }

    async function loadMe() {
      if (!token) return;
      try {
        const res = await apiFetch<{ user: { role: string; displayName: string; profilePhotoUrl?: string } }>("/auth/me", { token });
        setRole(res.user.role);
        setDisplayName(res.user.displayName);
        setProfilePhotoUrl(res.user.profilePhotoUrl ?? null);
        setProfilePhotoBust(Date.now());

        // Notification badge (best-effort)
        await refreshUnread(token);
      } catch {
        // Token is invalid/expired: log out locally
        clearAccessToken();
        setRole(null);
        setDisplayName(null);
        setUnreadCount(0);
      }
    }

    void loadMe();

    // Keep badge fresh even if the user stays on the same page (e.g. submits film).
    if (token) {
      interval = window.setInterval(() => {
        void refreshUnread(token);
      }, 15000);
    }

    // Instant refresh when notifications are updated elsewhere in the app.
    const onChanged = () => {
      if (token) void refreshUnread(token);
    };
    window.addEventListener("goeducate:notifications-changed", onChanged);
    const onMeChanged = () => {
      void loadMe();
    };
    window.addEventListener("goeducate:me-changed", onMeChanged);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      window.removeEventListener("goeducate:notifications-changed", onChanged);
      window.removeEventListener("goeducate:me-changed", onMeChanged);
    };
  }, [pathname]);

  const dashboardHref = useMemo(() => roleToDashboard(role), [role]);
  const apiBase = useMemo(() => (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, ""), []);
  const avatarSrc = profilePhotoUrl ? `${apiBase}${profilePhotoUrl}?v=${profilePhotoBust}` : null;

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
          {profilePhotoUrl ? (
            <>
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="View profile photo"
                title="Click to enlarge"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served from API static uploads; keep simple/reliable */}
                <img
                  src={avatarSrc ?? `${apiBase}${profilePhotoUrl}`}
                  alt="Profile photo"
                  className="h-8 w-8 rounded-full border border-white/10 object-cover"
                />
              </button>
              {photoOpen ? (
                <ImageLightbox
                  src={avatarSrc ?? `${apiBase}${profilePhotoUrl}`}
                  alt="Profile photo"
                  onClose={() => setPhotoOpen(false)}
                />
              ) : null}
            </>
          ) : null}
          <Link href={dashboardHref} className={navItem(dashboardHref)}>
            Dashboard
          </Link>
          {role === "coach" ? (
            <Link href="/coach/billing" className={navItem("/coach/billing")}>
              Billing
            </Link>
          ) : null}
          <Link href="/notifications" className={navItem("/notifications")}>
            <span className="inline-flex items-center gap-2">
              <span>Notifications</span>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </span>
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
          <Link href="/request-access" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            Request access
          </Link>
        </>
      )}
    </nav>
  );
}


