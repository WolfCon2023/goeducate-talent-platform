import Link from "next/link";

import { AdminGuard } from "../Guard";
import { AdminProfileAuditLogs } from "@/components/admin/AdminProfileAuditLogs";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default function AdminAuditLogsPage() {
  return (
    <AdminGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">Audit logs</div>
            <HelpIcon helpKey="admin.audit-logs" title="Admin audit logs" />
          </div>
          <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            ← Back to admin
          </Link>
        </div>
        <AdminProfileAuditLogs />
      </div>
    </AdminGuard>
  );
}


