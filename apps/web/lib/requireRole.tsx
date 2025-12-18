"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getAccessToken, getTokenRole } from "@/lib/auth";

const DASHBOARD_BY_ROLE: Record<string, string> = {
  player: "/player",
  coach: "/coach",
  evaluator: "/evaluator",
  admin: "/admin"
};

export function useRequireRole(allowed: readonly string[]) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const allowedKey = allowed.join(",");

  useEffect(() => {
    const token = getAccessToken();
    const role = getTokenRole(token);
    if (!token || !role) {
      setOk(false);
      router.push("/login");
      return;
    }
    const allowedSet = new Set(allowedKey.split(",").filter(Boolean));
    if (!allowedSet.has(role)) {
      setOk(false);
      router.push(DASHBOARD_BY_ROLE[role] ?? "/");
      return;
    }
    setOk(true);
  }, [router, allowedKey]);

  return ok;
}


