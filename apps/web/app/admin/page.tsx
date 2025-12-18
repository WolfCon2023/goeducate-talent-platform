import Link from "next/link";

import { Card } from "@/components/ui";
import { AdminCreateUser } from "@/components/AdminCreateUser";
import { AdminInviteGenerator } from "@/components/AdminInviteGenerator";
import { AdminCoachSubscriptionToggle } from "@/components/AdminCoachSubscriptionToggle";
import { AdminGuard } from "./Guard";

export default function AdminPage() {
  return (
    <AdminGuard>
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
            Admin UI for moderating content is planned. For now, you can create internal users below.
          </p>
        </Card>

        <AdminInviteGenerator />

        <AdminCoachSubscriptionToggle />

        <AdminCreateUser />
      </div>
    </AdminGuard>
  );
}


