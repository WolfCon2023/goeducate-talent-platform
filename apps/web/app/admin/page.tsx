import Link from "next/link";

import { Card } from "@/components/ui";
import { AdminCreateUser } from "@/components/AdminCreateUser";
import { AdminInviteGenerator } from "@/components/AdminInviteGenerator";
import { AdminUserManager } from "@/components/AdminUserManager";
import { AdminStats } from "@/components/AdminStats";
import { AdminPlayerMap } from "@/components/AdminPlayerMap";
import { AdminShowcases } from "@/components/AdminShowcases";
import { AdminShowcaseRegistrations } from "@/components/AdminShowcaseRegistrations";
import { AdminNotificationQueue } from "@/components/AdminNotificationQueue";
import { AdminEvaluationTemplates } from "@/components/AdminEvaluationTemplates";
import { AdminEvaluationForms } from "@/components/AdminEvaluationForms";
import { AdminEvaluations } from "@/components/AdminEvaluations";
import { AdminAccessRequests } from "@/components/AdminAccessRequests";
import { AdminEmailDiagnostics } from "@/components/AdminEmailDiagnostics";
import { AdminAuditLog } from "@/components/AdminAuditLog";
import { AdminGuard } from "./Guard";

export default function AdminPage() {
  return (
    <AdminGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-2 text-sm text-white/80">User and content management will be built next.</p>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Home
          </Link>
        </div>

        <div className="sticky top-4 z-40 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]/80 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Jump to</div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-stats">
                Stats
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-player-map">
                Player map
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-showcases">
                Showcases
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-showcase-registrations">
                Showcase registrations
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-notifications">
                Notifications
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-email">
                Email
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-evaluations">
                Evaluations
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-audit">
                Audit log
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-users">
                Users
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-access-requests">
                Access requests
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-invites">
                Invites
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-templates">
                Templates
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-forms">
                Forms
              </a>
              <a className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/90 hover:bg-white/10" href="#admin-create-user">
                Create user
              </a>
            </div>
          </div>
        </div>

        <section id="admin-stats" className="scroll-mt-28">
          <AdminStats />
        </section>

        <section id="admin-player-map" className="scroll-mt-28">
          <AdminPlayerMap />
        </section>

        <section id="admin-showcases" className="scroll-mt-28">
          <AdminShowcases />
        </section>

        <section id="admin-showcase-registrations" className="scroll-mt-28">
          <AdminShowcaseRegistrations />
        </section>

        <section id="admin-notifications" className="scroll-mt-28">
          <AdminNotificationQueue />
        </section>

        <section id="admin-email" className="scroll-mt-28">
          <AdminEmailDiagnostics />
        </section>

        <section id="admin-evaluations" className="scroll-mt-28">
          <AdminEvaluations />
        </section>

        <section id="admin-audit" className="scroll-mt-28">
          <AdminAuditLog />
        </section>

        <section id="admin-users" className="scroll-mt-28">
          <AdminUserManager />
        </section>

        <section id="admin-access-requests" className="scroll-mt-28">
          <AdminAccessRequests />
        </section>

        <section id="admin-invites" className="scroll-mt-28">
          <AdminInviteGenerator />
        </section>

        <section id="admin-templates" className="scroll-mt-28">
          <AdminEvaluationTemplates />
        </section>

        <section id="admin-forms" className="scroll-mt-28">
          <AdminEvaluationForms />
        </section>

        <section id="admin-create-user" className="scroll-mt-28">
          <AdminCreateUser />
        </section>
      </div>
    </AdminGuard>
  );
}


