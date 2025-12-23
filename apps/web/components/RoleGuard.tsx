"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { getAccessToken, getTokenRole } from "@/lib/auth";
import { toast } from "@/components/ToastProvider";

export function RoleGuard(props: { allowed: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = React.useState<string | undefined>(undefined);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const token = getAccessToken();
    setRole(getTokenRole(token));
    setReady(true);
  }, []);

  // Not logged in
  if (!ready) return null;
  if (!role) {
    toast({ kind: "info", title: "Login required", message: "Please sign in to continue.", ttlMs: 3500 });
    const returnTo = encodeURIComponent(pathname || "/");
    router.replace(`/login?reason=login_required&returnTo=${returnTo}`);
    return null;
  }

  // Logged in, but not allowed
  if (!props.allowed.includes(role)) {
    toast({ kind: "error", title: "Access denied", message: "Your account does not have permission to view this page.", ttlMs: 4500 });
    router.replace(role === "admin" ? "/admin" : role === "coach" ? "/coach" : role === "evaluator" ? "/evaluator" : "/player");
    return null;
  }

  return <>{props.children}</>;
}


