"use client";

import { RoleGuard } from "@/components/RoleGuard";

export function PlayerGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["player"]}>{props.children}</RoleGuard>;
}


