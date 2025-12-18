"use client";

import { useRequireRole } from "@/lib/requireRole";

export function RoleGuard(props: { allowed: string[]; children: React.ReactNode }) {
  const ok = useRequireRole(props.allowed);
  if (ok !== true) return null;
  return <>{props.children}</>;
}


