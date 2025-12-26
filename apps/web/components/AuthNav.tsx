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
  const [messagesUnreadCount, setMessagesUnreadCount] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const tokenRole = getTokenRole(token);
    setRole(tokenRole ?? null);
    setDisplayName(null);
    setProfilePhotoUrl(null);
    setUnreadCount(0);
    setMessagesUnreadCount(0);
    let cancelled = false;
    let abort: AbortController | null = null;
    let pollTimer: any = null;

    async function refreshUnread(t: string) {
      const unread = await apiFetch<{ count: number }>("/notifications/unread-count", { token: t }).catch(() => ({ count: 0 }));
      if (!cancelled) setUnreadCount(unread.count ?? 0);
    }

    async function refreshMessagesUnread(t: string) {
      const res = await apiFetch<{ conversations: Array<{ unread?: number }> }>("/messages/conversations?limit=100", {
        token: t,
        retries: 1,
        retryOn404: true
      }).catch(() => ({ conversations: [] as Array<{ unread?: number }> }));
      const total = (res.conversations ?? []).reduce((sum, c) => sum + (typeof c.unread === "number" ? c.unread : 0), 0);
      if (!cancelled) setMessagesUnreadCount(total);
    }

    async function startMessagesUnreadStream(t: string) {
      // Use fetch streaming so we can pass Authorization header (EventSource can't set headers).
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
      if (!apiBase) return;
      try {
        const res = await fetch(`${apiBase}/messages/stream`, {
          method: "GET",
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${t}` }
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const lines = raw.split("\n").map((l) => l.trimEnd());
            const eventLine = lines.find((l) => l.startsWith("event:"));
            const dataLine = lines.find((l) => l.startsWith("data:"));
            const event = eventLine ? eventLine.slice("event:".length).trim() : "";
            const dataStr = dataLine ? dataLine.slice("data:".length).trim() : "";
            if (event === "unread" && dataStr) {
              try {
                const parsed = JSON.parse(dataStr) as { count?: number };
                if (!cancelled && typeof parsed.count === "number") setMessagesUnreadCount(parsed.count);
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // ignore; polling + events remain
      }
    }

    async function startUnreadStream(t: string) {
      // Use fetch streaming so we can pass Authorization header (EventSource can't set headers).
      abort?.abort();
      abort = new AbortController();
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
      if (!apiBase) return;

      try {
        const res = await fetch(`${apiBase}/notifications/stream`, {
          method: "GET",
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${t}` },
          signal: abort.signal
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // Parse minimal SSE framing
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);

            const lines = raw.split("\n").map((l) => l.trimEnd());
            const eventLine = lines.find((l) => l.startsWith("event:"));
            const dataLine = lines.find((l) => l.startsWith("data:"));
            const event = eventLine ? eventLine.slice("event:".length).trim() : "";
            const dataStr = dataLine ? dataLine.slice("data:".length).trim() : "";
            if (event === "unread" && dataStr) {
              try {
                const parsed = JSON.parse(dataStr) as { count?: number };
                if (!cancelled && typeof parsed.count === "number") setUnreadCount(parsed.count);
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // ignore; we'll fall back to periodic refresh via app events
      }
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
        // Messages badge (best-effort)
        await refreshMessagesUnread(token);
        // Start streaming updates (best-effort)
        void startUnreadStream(token);
        void startMessagesUnreadStream(token);
      } catch {
        // Token is invalid/expired: log out locally
        clearAccessToken();
        setRole(null);
        setDisplayName(null);
        setUnreadCount(0);
        setMessagesUnreadCount(0);
      }
    }

    void loadMe();

    // Instant refresh when notifications are updated elsewhere in the app.
    const onChanged = () => {
      if (token) void refreshUnread(token);
    };
    window.addEventListener("goeducate:notifications-changed", onChanged);
    const onMessagesChanged = () => {
      if (token) void refreshMessagesUnread(token);
    };
    window.addEventListener("goeducate:messages-changed", onMessagesChanged);
    const onMeChanged = () => {
      void loadMe();
    };
    window.addEventListener("goeducate:me-changed", onMeChanged);

    const onFocus = () => {
      if (token) void refreshMessagesUnread(token);
    };
    window.addEventListener("focus", onFocus);

    // Light polling as fallback (handles missed events / multi-tab updates).
    if (token) {
      pollTimer = setInterval(() => {
        void refreshMessagesUnread(token);
      }, 25_000);
    }

    return () => {
      cancelled = true;
      abort?.abort();
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener("goeducate:notifications-changed", onChanged);
      window.removeEventListener("goeducate:messages-changed", onMessagesChanged);
      window.removeEventListener("goeducate:me-changed", onMeChanged);
      window.removeEventListener("focus", onFocus);
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
    router.push("/login");
    router.refresh();
  }

  const editProfileHref =
    role === "player"
      ? "/player/profile"
      : role === "coach"
        ? "/coach/profile"
        : role === "evaluator"
          ? "/evaluator/profile"
          : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.("[data-auth-menu-root]")) return;
      setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  useEffect(() => {
    // Close menu on navigation changes
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="flex items-center gap-2 text-sm">
      {role ? (
        <>
          {role === "player" || role === "admin" ? (
            <Link href="/player" className={navItem("/player")}>
              Player
            </Link>
          ) : null}
          {role === "player" ? (
            <Link href="/player/film" className={navItem("/player/film")}>
              Film
            </Link>
          ) : null}
          {role === "player" ? (
            <Link href="/player/evaluations" className={navItem("/player/evaluations")}>
              Evaluations
            </Link>
          ) : null}
          {role === "coach" || role === "admin" ? (
            <Link href="/coach" className={navItem("/coach")}>
              Coach
            </Link>
          ) : null}
          {role === "evaluator" || role === "admin" ? (
            <Link href="/evaluator" className={navItem("/evaluator")}>
              Evaluator
            </Link>
          ) : null}
          <Link href="/showcases" className={navItem("/showcases")}>
            Showcases
          </Link>
          {role === "player" || role === "coach" || role === "admin" ? (
            <Link href="/showcases/registrations" className={navItem("/showcases/registrations")}>
              My registrations
            </Link>
          ) : null}
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
          <Link href="/kb" className={navItem("/kb")} title="Knowledge Base">
            KB
          </Link>
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
          <Link href="/messages" className={navItem("/messages")}>
            <span className="inline-flex items-center gap-2">
              <span>Messages</span>
              {messagesUnreadCount > 0 ? (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
                </span>
              ) : null}
            </span>
          </Link>
          <div className="relative" data-auth-menu-root>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-2)] hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span className="truncate max-w-[180px]">
                {displayName ? displayName : role}
              </span>
              <span className="text-[10px] text-[color:var(--muted-2)]">{role}</span>
              <span aria-hidden="true" className="text-[10px] text-white/60">
                ▼
              </span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
              >
                {editProfileHref ? (
                  <Link
                    href={editProfileHref}
                    role="menuitem"
                    className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    Edit profile
                  </Link>
                ) : null}
                <Link
                  href="/account/security"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                  onClick={() => setMenuOpen(false)}
                >
                  Account security
                </Link>
                <Link
                  href="/change-password"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                  onClick={() => setMenuOpen(false)}
                >
                  Change password
                </Link>
                {role === "evaluator" || role === "admin" ? (
                  <Link
                    href="/evaluator/notes"
                    role="menuitem"
                    className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    Notes tool
                  </Link>
                ) : null}
                <Link
                  href={dashboardHref}
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-white/90 hover:bg-white/5"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Link href="/login" className={navItem("/login")}>
            Login
          </Link>
          <Link href="/kb" className={navItem("/kb")} title="Knowledge Base">
            KB
          </Link>
          <Link href="/request-access" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            Request access
          </Link>
        </>
      )}
    </nav>
  );
}


