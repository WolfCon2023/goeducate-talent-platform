"use client";

import { RoleGuard } from "@/components/RoleGuard";

export function ShowcasesGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["player", "coach", "evaluator", "admin"]}>{props.children}</RoleGuard>;
}


