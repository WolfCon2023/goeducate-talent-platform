"use client";

import * as React from "react";

import { RoleGuard } from "@/components/RoleGuard";

export function EvaluatorGuard(props: { children: React.ReactNode }) {
  return <RoleGuard allowed={["evaluator", "admin"]}>{props.children}</RoleGuard>;
}


