import Link from "next/link";

import { Card } from "@/components/ui";
import { AdminCreateUser } from "@/components/AdminCreateUser";

export default function AdminPage() {
  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-2 text-sm text-slate-300">User and content management will be built next.</p>
        </div>
        <Link href="/" className="text-sm text-slate-300 hover:text-white">
          Home
        </Link>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Next</h2>
        <p className="mt-2 text-sm text-slate-300">
          Admin UI for creating evaluator/admin users and moderating content is planned. For now, use the API endpoints:
        </p>
        <ul className="mt-4 list-disc pl-5 text-sm text-slate-300">
          <li>
            <code className="text-slate-200">POST /admin/users</code> (admin-only)
          </li>
          <li>
            <code className="text-slate-200">GET /film-submissions/queue</code> (evaluator/admin)
          </li>
        </ul>
      </Card>

      <AdminCreateUser />
    </div>
  );
}


