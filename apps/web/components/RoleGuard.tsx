"use client";

import Link from "next/link";
import * as React from "react";

import { getAccessToken, getTokenRole } from "@/lib/auth";

export function RoleGuard(props: { allowed: string[]; children: React.ReactNode }) {
  const [role, setRole] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const token = getAccessToken();
    setRole(getTokenRole(token));
  }, []);

  // Not logged in
  if (!role) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">Login required</div>
        <p className="mt-2 text-sm text-white/80">Please sign in to continue.</p>
        <div className="mt-4">
          <Link href="/login" className="text-indigo-300 hover:text-indigo-200 hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  // Logged in, but not allowed
  if (!props.allowed.includes(role)) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">Access denied</div>
        <p className="mt-2 text-sm text-white/80">Your account does not have permission to view this page.</p>
      </div>
    );
  }

  return <>{props.children}</>;
}


