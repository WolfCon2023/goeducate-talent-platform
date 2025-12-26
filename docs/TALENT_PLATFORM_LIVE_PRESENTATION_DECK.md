# GoEducate Talent Platform — Live Presentation Deck (Talk Track + Demo Script)

**Purpose**: This is a *live presentation document* (speaker notes + demo runbook).  
**Target audience**: Executives + operators + product stakeholders (mixed).  
**Primary CTA**: “This platform reliably turns film into evaluations and coach-player connections with measurable operations.”

---

## How to use this doc in a live meeting

- **Presenter**: follow the “What to say” bullets.
- **Driver**: follow “Demo steps” exactly in order.
- **Timeboxing**: choose one run:
  - **10‑minute**: run Sections 1 → 5 and do only 1 demo (Admin Evaluations).
  - **20‑minute**: run Sections 1 → 8 and do the full demo sequence.
  - **30‑minute**: include Section 9 (Q&A) + optional deep-dive modules.

---

## 0) Setup checklist (do this 10 minutes before)

### Accounts to have ready
- **Admin** user
- **Evaluator** user
- **Coach** user (one active subscription + one inactive for gated UX)
- **Player** user (with a film submission ready; ideally one completed evaluation)

### Tabs to pre-open (in order)
- Web app: `https://talent.goeducateinc.org`
- Admin Evaluations: `/admin/evaluations`
- Admin Email: `/admin/email`
- Admin Metrics: `/admin/metrics`
- Messages: `/messages`
- KB: `/kb`

### Data prep
- Ensure at least one film submission exists in **submitted / in_review / needs_changes** and one in **completed**.
- Ensure at least one coach has a **watchlist** entry for the player with a completed evaluation.

---

## 1) Title (1 minute)

### Slide / Title
**GoEducate Talent Platform**  
Film → Evaluation → Insights → Connections

### What to say
- “This is our role-based talent evaluation platform.”
- “It supports Players, Evaluators, Coaches, and Admin Ops with reliability features like email auditing and queue SLAs.”

---

## 2) The problem (1 minute)

### What to say
- “Talent evaluation workflows usually break down because operations are manual: who owns what, what’s overdue, what emails failed, and where the truth lives.”
- “Our goal is to make the workflow measurable and self-serve.”

---

## 3) The solution (1 minute)

### What to say
- “Players submit film and see evaluation progress.”
- “Evaluators get a queue with ‘my queue’ and overdue visibility.”
- “Coaches search and track players via watchlists, then receive deep links to evaluations.”
- “Admins run ops: assignment, backlog KPIs, email delivery diagnostics, and trends/threshold metrics.”

---

## 4) Product tour map (30 seconds)

### What to say
- “I’m going to demo the platform in this exact order: Admin ops → Evaluator workflow → Player experience → Coach value → Messaging → KB → Metrics.”

---

## 5) Demo 1 — Admin Evaluations (Ops-ready) (6–8 minutes)

### Demo goal
Show that the queue is measurable, assignable, filterable, and accountable.

### Demo steps (driver)
1. Go to `/admin/evaluations`
2. Point to KPI cards (open / unassigned / overdue / avg age)
3. Toggle **Overdue only**
4. Filter by **Assigned evaluator** (pick one)
5. Select 2–3 rows → **Assign** (use an assignment note)
6. Open one evaluation detail row

### What to say (speaker)
- “This screen is the ops command center: it shows KPIs and lets us take action.”
- “Overdue is computed by age; we can isolate SLA problems instantly.”
- “Assignments support notes—so we can capture context, not just ownership.”
- “Each record links to a read-only evaluation report view—not just the form.”

### Optional callouts (if asked)
- “Assignments and sensitive actions are rate-limited and audited.”
- “Data freshness is driven by SSE/events plus fallback polling—reduces refresh clicks.”

---

## 6) Demo 2 — Evaluator Queue + completion (4–6 minutes)

### Demo goal
Show “My queue”, overdue handling, and completing an evaluation that triggers notifications/emails.

### Demo steps (driver)
1. Login as Evaluator
2. Go to `/evaluator`
3. Toggle **My queue**
4. Toggle **Overdue only**
5. Open a film submission: `/evaluator/film/[filmSubmissionId]`
6. Complete evaluation and submit

### What to say
- “Evaluators work in a focused queue; they can see what’s assigned to them and what’s overdue.”
- “When an evaluation is completed, the player gets an in-app notification and an email; ops is BCC’d for visibility.”

---

## 7) Demo 3 — Player film + evaluation report (3–5 minutes)

### Demo goal
Show that the player can submit film (validated) and see the full evaluation report.

### Demo steps
1. Login as Player
2. Go to `/player/film`
3. Open a submission
4. Switch to evaluation view (`?view=evaluation`) if completed
5. Show Print/PDF

### What to say
- “Players can’t submit empty film—video URL or upload is required.”
- “When completed, the evaluation is a report view with rubric breakdown—not a blank form to re-fill.”

---

## 8) Demo 4 — Coach value: search + watchlist + deep links (3–5 minutes)

### Demo goal
Show coach acquisition loop and subscription gating.

### Demo steps
1. Login as Coach
2. Go to `/coach/search`
3. Open a player profile `/coach/player/[userId]`
4. Show watchlist actions + evaluation links
5. Trigger “Request contact” on a gated profile (use inactive coach if needed)
6. Show upgrade CTA → `/coach/billing`

### What to say
- “Coaches can discover players, track them, and get evaluation notifications with deep links.”
- “Contact is subscription-gated with explicit locked-state UX and direct upgrade path.”

---

## 9) Demo 5 — Messaging (2–4 minutes)

### Demo goal
Show safe recipient selection and unread badge correctness.

### Demo steps
1. Go to `/messages`
2. Start a conversation using recipient typeahead
3. Send a message
4. Open the other account in a separate browser/profile (optional)

### What to say
- “Recipients are selected by user identity (userId) with typeahead—no raw DB IDs.”
- “Unread counts update via a lightweight stream and are corrected via polling fallback.”

---

## 10) Demo 6 — Knowledge Base (KB) (2–4 minutes)

### Demo goal
Show self-serve help + admin authoring with history.

### Demo steps
1. Go to `/kb` and search for an article
2. Open an article and submit “Was this helpful?”
3. Login as Admin → go to `/admin/kb`
4. Open an article in the modal → show internal scrolling + history

### What to say
- “KB reduces support volume: users can search/browse; only admins can author and publish.”
- “Articles have audit history and a controlled category dropdown.”

---

## 11) Demo 7 — Metrics (Exec-ready) (2–4 minutes)

### Demo goal
Show leadership visibility: thresholds, trends, and drilldowns.

### Demo steps
1. Go to `/admin/metrics`
2. Show KPI cards and threshold coloring
3. Open trends: `/admin/metrics/trends?weeks=12`

### What to say
- “Metrics show what leadership cares about: activation, throughput, overdue, and reliability.”
- “Trends support weekly direction—not just point-in-time numbers.”

---

## 12) Closing (30 seconds)

### What to say
- “We now have an end-to-end system: film submissions are operationally manageable, evaluations are measurable, coaches have a subscription-driven value loop, and support is reduced via KB.”
- “Next steps: scale the evaluator workload tooling and expand email resend/diagnostics, then refine PDF export templates.”

---

## Appendix A — Common questions (short answers)

- **“How do we know emails are working?”**  
  Use `/admin/email` to see audit logs, failures, and resend support.

- **“What happens during deployments?”**  
  API returns commit SHA headers and `/health` exposes commit info to detect stale instances.

- **“Is there real-time updates?”**  
  Notifications and message unread use SSE + fallback refresh mechanisms.


