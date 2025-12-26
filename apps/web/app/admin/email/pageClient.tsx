"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AdminEmailDiagnostics } from "@/components/AdminEmailDiagnostics";
import { HelpIcon } from "@/components/kb/HelpIcon";

export function AdminEmailPageClient() {
  const search = useSearchParams();
  const status = search.get("status") ?? "";
  const type = search.get("type") ?? "";
  const to = search.get("to") ?? "";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-semibold tracking-tight">Email</div>
          <HelpIcon helpKey="admin.email.diagnostics" title="Email diagnostics" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to admin
          </Link>
        </div>
      </div>

      <AdminEmailDiagnostics initialFilterStatus={status} initialFilterType={type} initialFilterTo={to} />
    </div>
  );
}


