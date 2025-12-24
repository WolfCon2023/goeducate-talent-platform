import Link from "next/link";

import { AdminGuard } from "../Guard";
import { AdminProfileAuditLogs } from "@/components/admin/AdminProfileAuditLogs";

export default function AdminAuditLogsPage() {
  return (
    <AdminGuard>
      <div className="grid gap-6">
        <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
          ← Back to admin
        </Link>
        <AdminProfileAuditLogs />
      </div>
    </AdminGuard>
  );
}


