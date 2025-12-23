"use client";

import * as React from "react";

import { RoleGuard } from "@/components/RoleGuard";

export function PlayerGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["player", "admin"]}>{props.children}</RoleGuard>;
}


