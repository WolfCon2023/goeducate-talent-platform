"use client";

import { RoleGuard } from "@/components/RoleGuard";

export function CoachGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["coach", "admin"]}>{props.children}</RoleGuard>;
}


