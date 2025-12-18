"use client";

import { RoleGuard } from "@/components/RoleGuard";

export function EvaluatorGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["evaluator", "admin"]}>{props.children}</RoleGuard>;
}


