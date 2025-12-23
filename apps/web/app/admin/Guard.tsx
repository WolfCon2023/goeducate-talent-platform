"use client";

import * as React from "react";

import { RoleGuard } from "@/components/RoleGuard";

export function AdminGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["admin"]}>{props.children}</RoleGuard>;
}


