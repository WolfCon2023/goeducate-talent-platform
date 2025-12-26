# GoEducate Talent Platform — Release + Product + User Guide (All‑in‑One)

**Audience**: Company leadership, admins, evaluators, coaches, players, and support/operators  
**Apps**:
- **Web**: `https://talent.goeducateinc.org`
- **API**: `https://api-talent.goeducateinc.org`

---

## Executive summary (what this platform does)

GoEducate Talent is a role-based talent evaluation platform that helps:
- **Players** submit film and receive structured evaluations.
- **Evaluators** manage an evaluation queue, score athletes consistently, and deliver reports.
- **Coaches** discover players, track them via watchlists, and access evaluations and contact (subscription-gated).
- **Admins** manage operations: users, showcases, evaluations queue, email delivery, knowledge base, and executive-ready metrics.

---

## Presentation (slide-ready outline)

### Slide 1 — Title
**GoEducate Talent Platform**  
Film → Evaluation → Insights → Connections

### Slide 2 — Who it’s for
- **Players**: submit film, get evaluated, share profile
- **Evaluators**: queue + tools for consistent scoring
- **Coaches**: search + watchlist + evaluations + contact workflow
- **Admins**: operations, metrics, email reliability, auditability

### Slide 3 — Core workflow (end-to-end)
1. Player submits film  
2. Submission enters queue (admin/evaluator visibility)  
3. Assignment + evaluation completion  
4. Player receives evaluation notification + email  
5. Subscribed coaches tracking the player receive a watchlist notification  

### Slide 4 — Reliability + observability
- Email audit log + resend tools
- Queue SLA and overdue tracking
- Metrics dashboard with trends + thresholds

### Slide 5 — Self-serve support
- In-app Knowledge Base (KB) + contextual “?” help
- Admin authoring + publishing + audit history

### Slide 6 — What’s shipped in this release
- Admin evaluations queue: KPIs, bulk actions, workload
- Coach search + watchlist deep links
- Secure contact gating
- Messaging unread accuracy + improvements
- Metrics: alerts, trends, drilldowns
- Email diagnostics and ops digest

### Slide 7 — What’s next (recommended roadmap)
- PDF export “nice print” templates per sport
- SLA policy automation + assignments dashboard
- Expanded email resend support + delivery provider insights
- Messaging: attachments + moderation tools (optional)

---

## Release notes (high-signal)

### Major improvements
- **Admin Evaluations is ops-ready**
  - Queue **KPIs**: open, unassigned, overdue, avg age
  - **Overdue highlighting**
  - **Bulk assignment/unassignment** + assignment notes
  - **Evaluator workload** table with deep links
  - **Overdue-only** and **assigned evaluator** filters
- **Evaluator Queue**
  - “My queue” and **Overdue-only** toggle
- **Coach value unlock**
  - Player search + **Request contact** CTA (subscription-gated)
  - Watchlist shows **latest evaluation** + deep link to evaluation report
  - Watchlist evaluation notifications show film title + grade
- **Email reliability**
  - Email audit log filters (including time window)
  - Resend support indicators + reasons
  - Admin-triggered **Ops digest email**
- **Messaging**
  - Improved unread count correctness (mark-read + realtime-ish updates)
- **Auditability**
  - Admin audit logging for sensitive actions like film assignment and user deletion

---

## Roles, permissions, and navigation

### Roles
- **Player**
- **Evaluator**
- **Coach**
- **Admin**

### Core routes (by role)
- **Player**
  - Dashboard: `/player`
  - Film submissions: `/player/film`
  - Film submission detail + evaluation: `/player/film/[filmSubmissionId]?view=evaluation`
  - Evaluation history: `/player/evaluations`
  - Profile: `/player/profile`
- **Evaluator**
  - Dashboard / queue: `/evaluator`
  - Film detail (complete evaluation): `/evaluator/film/[filmSubmissionId]`
  - Notes tool: `/evaluator/notes`
  - Profile: `/evaluator/profile`
- **Coach**
  - Dashboard: `/coach`
  - Player search: `/coach/search`
  - Player profile: `/coach/player/[userId]`
  - Film/evaluation detail (coach-facing): `/coach/film/[filmSubmissionId]?view=evaluation`
  - Billing: `/coach/billing`
  - Profile: `/coach/profile`
- **Admin**
  - Dashboard: `/admin`
  - Evaluations queue: `/admin/evaluations`
  - Evaluation detail: `/admin/evaluations/[filmSubmissionId]`
  - Metrics: `/admin/metrics` and trends: `/admin/metrics/trends`
  - Email: `/admin/email`
  - KB admin: `/admin/kb`
  - Audit logs: `/admin/audit-logs`

---

## Player guide

### Player: Submit film
1. Go to **Film**: `/player/film`
2. Click **Submit film**
3. Provide **either**:
   - **Video URL**, or
   - **Uploaded video** (if enabled)
4. Add title/opponent/date/notes
5. Submit → you’ll see status move to **submitted**

**What happens next**
- Your submission enters the evaluator queue.
- If changes are required, status becomes **needs_changes**.
- When complete, status becomes **completed** and the evaluation appears in the film detail page.

### Player: View evaluation
1. Open `/player/film`
2. Click a submission
3. If completed, scroll to **Evaluation** (or use `?view=evaluation`)
4. Use **Print / PDF** if you need a printable copy.

### Player: Profile
1. Use header dropdown → **Edit profile** (or go to `/player/profile`)
2. Save to enable visibility/contact settings (if applicable)

---

## Evaluator guide

### Evaluator: Queue workflow
1. Go to `/evaluator`
2. Use:
   - **All**: see the full queue
   - **My queue**: only items assigned to you
   - **Overdue only**: focus on SLA breaches
3. For an item:
   - **Assign to me** (if unassigned)
   - **Mark in review** to indicate active work
   - **Return for edits** if player needs changes
   - **Complete evaluation** to finish and notify stakeholders

### Evaluator: Notes tool (best practice)
1. Go to `/evaluator/notes`
2. Pick sport template (if applicable)
3. Take structured notes (autosaves)
4. Copy into evaluation submission when ready

---

## Coach guide

### Coach: Player search
1. Go to `/coach/search`
2. Filter by sport/position/state/grad year/etc.
3. Actions:
   - **Add to watchlist**: track future evaluations
   - **Request contact**:
     - If subscribed, request contact (if player contact is hidden)
     - If not subscribed, you’ll be prompted to upgrade via `/coach/billing`

### Coach: Watchlist
1. Go to `/coach`
2. In **Watchlist**, each player shows:
   - Player info
   - **Latest evaluation** (when available) with a deep link to the evaluation report

### Coach: Billing / subscription
1. Go to `/coach/billing`
2. View subscription status and plan
3. Manage subscription (upgrade, billing portal, downgrade scheduling where available)

---

## Admin guide

### Admin: Evaluations queue (ops-ready)
Go to `/admin/evaluations`.

**What you can do**
- **KPI view**: open/unassigned/overdue/avg age
- **Filters**:
  - Overdue-only
  - Assigned evaluator
  - Has evaluation report, assigned/unassigned, status, search
- **Bulk actions**:
  - Select rows → assign evaluator
  - Add assignment note (optional)
- **Evaluator workload**:
  - See open+overdue assigned counts by evaluator
  - Click through to filtered queues

### Admin: Metrics (exec-ready)
Go to `/admin/metrics`.

**Includes**
- KPI cards (with thresholds)
- Alerts panel
- Trends page: `/admin/metrics/trends`
- Data quality section

### Admin: Email delivery
Go to `/admin/email`.

**Includes**
- SMTP configuration visibility
- Audit log with filters (including time window)
- Resend (when supported)
- Ops digest email (admin-triggered)

### Admin: Knowledge Base (KB)
Go to `/admin/kb`.

**Workflow**
- Create/edit articles (Markdown)
- Tag/categorize/helpKeys
- Publish/unpublish
- Review history/audit in the modal

### Admin: User management
From `/admin`, open **Users** section.
- Search/filter users
- Edit via modal (full profile view)
- Sensitive actions are rate-limited and audited

---

## Troubleshooting / FAQ

### “I got a 404 on a new feature endpoint”
This usually means **mixed deployment** (old API instance still live). Wait a minute and retry. If it persists, check the API `/health` and confirm the commit SHA.

### “Request contact says subscription required”
That’s expected for coaches who are not subscribed. Upgrade at `/coach/billing`.

### “Resend is disabled”
Resend is only supported for certain email types (e.g., invite, access request emails, notifications with full metadata). The UI shows the reason.

### “Unread messages badge seems stale”
The header uses SSE (best effort) plus fallback polling. If it’s stale after reading a thread, refresh once; it should resync quickly.

---

## Support playbook (internal)

### Where to look first
- **Admin Email**: `/admin/email` → failures last 24h + resend tools
- **Admin Evaluations**: `/admin/evaluations` → overdue-only + workload
- **Admin Metrics**: `/admin/metrics` → alerts + trends
- **Audit logs**: `/admin/audit-logs`

### Recommended operational targets (starter defaults)
- Queue overdue SLA: **72 hours**
- Email fail rate: **< 5%**
- p90 turnaround: **< 120 hours**

---

## Appendix: Glossary
- **Film submission**: player-submitted media + metadata that enters the evaluation queue
- **Evaluation report**: structured assessment produced by an evaluator
- **SLA/Overdue**: time-based threshold for open queue items
- **Watchlist**: coach tracking list for players
- **KB (Knowledge Base)**: in-app support content, admin-authored, user-readable


