# GoEducate Talent Platform — Technical Specification

**Monorepo**: React/Next.js (web) + Node/Express (api) + shared TypeScript package  
**Primary goals**:
- Role-based workflows (Player, Coach, Evaluator, Admin)
- Measurable operations (queue KPIs, overdue, auditability)
- Reliability (timeouts/retries, email audit, deploy verification)
- Self-serve support (Knowledge Base + contextual help)

---

## 1) System architecture

### Components
- **Web app**: Next.js App Router (`apps/web`)
- **API**: Express server (`apps/api`)
- **Shared package**: schemas/utilities (`packages/shared`)
- **Database**: MongoDB (Mongoose models in `apps/api/src/models`)
- **Payments**: Stripe (coach subscriptions and billing portal)
- **Email**: SMTP via Nodemailer with audit logging
- **Realtime-ish**: SSE streams for notifications and message unread

### Runtime boundaries
- Web is responsible for UI/UX, session token storage, routing/guards, and calling API.
- API owns authentication, authorization, persistence, and all side effects (email, notifications, Stripe, auditing).

---

## 2) Repo layout (high level)

### `apps/api`
- **Entry**: `apps/api/src/server.ts`
- **Routing**: `apps/api/src/routes/*`
- **Models**: `apps/api/src/models/*`
- **Middleware**: `apps/api/src/middleware/*` (auth, rate limit, logging, activity tracking)
- **Email**: `apps/api/src/email/*` (mailer, audit, templates)
- **Realtime buses**:
  - Notifications bus: `apps/api/src/notifications/bus.ts`
  - Messages bus: `apps/api/src/messages/bus.ts`

### `apps/web`
- **App Router pages**: `apps/web/app/*`
- **Components**: `apps/web/components/*`
- **API client**: `apps/web/lib/api.ts` (`apiFetch` with timeout + retries)

### `packages/shared`
- Zod schemas and shared types/constants (used by both apps)

---

## 3) Authentication and authorization

### Auth model
- API issues a bearer token (JWT) on login.
- Web stores token and attaches it in `Authorization: Bearer ...`.

### RBAC
- Core enforcement uses API middleware:
  - `requireAuth`
  - `requireRole([...])`
- Web uses route guards for UX, but API is the source of truth.

### Unauthorized UX behavior
- Web surfaces “session expired” toasts on 401 via `apiFetch` and encourages re-login.

---

## 4) API server lifecycle and deployment constraints (Railway)

### Startup strategy
Implemented in `apps/api/src/server.ts`:
- Bind to `process.env.PORT` when injected (and log chosen port).
- Also bind a fallback listener on `8080` for platform healthcheck compatibility.
- Delay Mongo connection until after server is listening, with retry/backoff so healthchecks can pass even when Mongo is slow.
- Stamp responses with `x-goeducate-commit` to debug stale rollouts.

### Health endpoint
- `GET /health` returns `{ ok: true, railway: { gitCommitSha, environment, service } }`

### Environment validation
`apps/api/src/env.ts` uses Zod and includes a safeguard where `PORT=""` is treated as unset.

---

## 5) API client contract (Web → API)

### `apiFetch` behavior (`apps/web/lib/api.ts`)
- Sets JSON content-type and optional bearer token
- Adds:
  - **timeout** (default 15s)
  - **retries** (default 1, up to 4)
  - retry on 502/503/504
  - optional retry on 404 (`retryOn404`) to ride through mixed deployments
- On 401 in browser, dispatches a toast: “Session expired”

---

## 6) Core domain workflows

### 6.1 Film submission (Player)

#### Create submission
- `POST /film-submissions` (Player-only)
- Validates payload with `FilmSubmissionCreateSchema` (shared)
- Enforces “no empty submissions”: must include either:
  - `videoUrl`, or
  - `cloudinaryPublicId`

#### Player list
- `GET /film-submissions/me` (Player-only)

#### Player detail usage
- Web routes include:
  - `/player/film`
  - `/player/film/[filmSubmissionId]`

#### Queue notifications
On submission:
- Creates in-app notification for player (`FILM_SUBMITTED`)
- Best-effort emails to player and ops/evaluators (config-driven)
- Creates internal in-app notifications for evaluators/admins to keep queue visible

### 6.2 Queue (Evaluator/Admin)

#### Queue endpoint
- `GET /film-submissions/queue` (Evaluator/Admin)
- Query params:
  - `mine=1` → only items assigned to current evaluator
  - `overdueOnly=1`
- Includes derived fields:
  - `ageHours`
  - `isOverdue`
- Joins player profile and assigned evaluator for display

### 6.3 Evaluation submission + completion notifications

#### Submit evaluation report
- `POST /evaluations` (Evaluator/Admin)
- Validates with `EvaluationReportCreateSchema` (shared)
- Assignment rules:
  - If evaluator role and film is assigned to someone else → 409
  - If evaluator role and film unassigned → auto-assign on first completion attempt
  - Film status transitions to `COMPLETED`

#### Grade computation
If `overallGrade` not provided but rubric is present:
- Compute grade from rubric + active evaluation form for sport (if present)
- Store `overallGrade`, `overallGradeRaw`, and a suggested projection label/key

#### Notifications and emails on completion
When evaluation is completed:
- Player gets in-app notification linking to full report:
  - `/player/film/[filmSubmissionId]?view=evaluation`
- Email is sent to player (best effort) and **BCCs ops**, ensuring `info@goeducateinc.org` is included.
- Watchlisted subscribed coaches get notification + email deep link:
  - `/coach/film/[filmSubmissionId]?view=evaluation`

---

## 7) Notifications subsystem

### Model
- `NotificationModel` in `apps/api/src/models/Notification.ts`

### API
- `GET /notifications/me`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/me/read`
- `DELETE /notifications/:id`
- `DELETE /notifications/me`

### Realtime updates (SSE)
- `GET /notifications/stream`
- Uses an in-memory bus to publish “notifications changed” events and recompute unread counts.

---

## 8) Messaging subsystem (1:1 conversations)

### Goals
- Prevent raw DB IDs in the UI
- Provide a safe recipient selection UX (typeahead)
- Maintain accurate unread badge counts across tabs/devices with best-effort realtime

### API
- `GET /messages/recipients?q=...&role=...&limit=...` (typeahead)
- `GET /messages/conversations`
- `GET /messages/stream` (SSE unread updates)
- Conversation read endpoints exist to keep unread correct:
  - `POST /messages/conversations/:id/read`

### Realtime updates
The API publishes changes using `apps/api/src/messages/bus.ts`, and the web header subscribes via fetch streaming.

---

## 9) Knowledge Base (KB)

### Public read endpoints (published only unless admin)
- `GET /kb/search`
- `GET /kb/articles/:slug`
- `GET /kb/categories`
- `GET /kb/tags`
- `POST /kb/articles/:slug/feedback` (requires auth)

### Admin endpoints
Implemented in `apps/api/src/routes/adminKb.ts`:
- `GET /admin/kb/articles`
- `GET /admin/kb/articles/:id`
- `PUT /admin/kb/articles/:id`
- `POST /admin/kb/articles`
- `POST /admin/kb/articles/:id/publish`
- `POST /admin/kb/articles/:id/unpublish`
- `DELETE /admin/kb/articles/:id`
- `GET /admin/kb/articles/:id/history`

### Category controls
Admin KB category is restricted to a curated dropdown (`KB_CATEGORIES`).

### Audit/history
Each admin edit creates a history record (`KnowledgeBaseArticleHistoryModel`) with actor metadata.

---

## 10) Admin metrics

### Admin-only router
`apps/api/src/routes/adminMetrics.ts` (guarded by `requireRole([ADMIN])`).

### Key features
- Configurable thresholds and targets
- Summary endpoint aggregates:
  - Users by role
  - DAU/WAU/MAU by role (DailyActiveUser model)
  - Profile completion scoring (shared compute functions)
  - Queue backlog + overdue counts
  - Evaluation turnaround time percentiles
  - Evaluator throughput with evaluator name/email resolution
  - Engagement (watchlist, contact requests, messages)
  - Funnel events (search → watchlist → contact → checkout → activated)
  - Stripe best-effort KPIs (if configured)

### Web trends route
The web page for trends is `/admin/metrics/trends` (App Router page), which calls the API.

---

## 11) Email subsystem + audit log

### Goals
- Make email delivery observable and support resend where safe

### Email audit
- Email sending is wrapped to create `EmailAuditLog` entries.
- Admin UI reads audit rows and indicates “Resend supported?” and why/why not.

### Ops digest email
- Admin action triggers digest email (fails + backlog/overdue summaries).

---

## 12) Rate limiting + auditing

### Rate limiting
Sensitive endpoints use `rateLimit` middleware with different key prefixes:
- e.g., admin email operations, film assignment/status changes

### Auditing
Admin actions log events such as:
- user changes/deletions
- film assignment/unassignment
- other sensitive ops actions

---

## 13) Non-functional requirements (NFRs)

### Reliability
- Timeouts + retries on API calls (web client)
- Best-effort side effects (emails) should not block core writes
- SSE with keep-alives + fallback polling

### Security
- RBAC enforced on API
- Avoid user enumeration on public recovery flows
- Hash sensitive secrets (reset tokens, security question answers)

### Observability
- Request logging middleware with correlation and latency
- Commit SHA stamping on responses for deploy verification

---

## 14) Configuration (high-level)

API env vars are validated in `apps/api/src/env.ts`. Highlights:
- `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `INVITE_FROM_EMAIL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`
- Ops: `SUBMISSION_ALERT_EMAILS`
- Uploads: `UPLOADS_DIR`

---

## 15) Open questions / decisions (fill in as needed)

- SLA definition: should overdue hours be configurable per sport or per tier?
- Evaluation form lifecycle: version pinning rules when forms update mid-season
- Messaging policy: allowed recipient roles and moderation requirements
- Data retention: email audit retention window, event telemetry retention


