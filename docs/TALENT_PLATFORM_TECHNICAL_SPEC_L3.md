# GoEducate Talent Platform — Technical Specification (Level 3 / Audit-Grade)

**Document class**: Internal — Confidential  
**System**: GoEducate Talent Platform (Web + API)  
**Repo**: `goeducate-talent-platform` (monorepo)  
**Last updated**: 2025-12-26  

---

## 0) Document control

### 0.1 Ownership
- **Product owner**: TBD
- **Engineering owner**: TBD
- **Security owner**: TBD
- **Operations owner**: TBD

### 0.2 Approvals
- **Approved by**: TBD
- **Approval date**: TBD
- **Review cadence**: Quarterly, and after any auth/billing/email changes

### 0.3 Change log
| Version | Date | Author | Summary |
|---|---:|---|---|
| 1.0 | 2025-12-26 | Cursor agent | Initial Level 3 specification based on current codebase |

---

## 1) Scope and goals

### 1.1 In-scope
- Role-based workflows (Player, Coach, Evaluator, Admin)
- Film submissions + evaluation lifecycle
- Coach search, watchlists, and contact gating (subscription)
- Admin operations: queue KPIs, assignment, email diagnostics/resend, metrics, KB authoring, audit logs
- Messaging (1:1 conversations) with unread counts
- Knowledge Base (public read, admin authoring) with history/audit
- Deployment constraints and reliability patterns (Railway)

### 1.2 Out-of-scope (for this spec)
- Mobile native apps
- Third-party CRM integrations
- Full SOC2 control evidence collection and monitoring tooling configuration (not implemented in repo)

### 1.3 High-level quality goals
- **Security**: RBAC enforced at API; prevent user enumeration in recovery flows; avoid leaking internal IDs to non-admin users
- **Reliability**: timeouts + retries on web API calls; best-effort email side effects; deployment version visibility
- **Operability**: KPIs, audit logs, email audit log, workload views, runbooks

---

## 2) System overview and architecture

### 2.1 Components
- **Web**: Next.js App Router (`apps/web`)  
  Responsibilities: UI, routing, auth UX, calling API, toasts, client-side revalidation/events.
- **API**: Express (`apps/api`)  
  Responsibilities: auth/RBAC, persistence, business logic, side effects (email/notifications/Stripe), metrics aggregation, auditing.
- **Database**: MongoDB (Mongoose models in `apps/api/src/models`)
- **Email**: SMTP via Nodemailer + audit log
- **Payments**: Stripe (coach subscriptions)
- **Realtime-ish**: Server-Sent Events (SSE) for unread counts (notifications + messages)
- **Shared**: `packages/shared` (Zod schemas, constants, completion scoring)

### 2.2 Trust boundaries (text diagram)
- **Browser (untrusted)** → HTTPS → **Web app (trusted UI layer)** → HTTPS → **API (trusted)** → **MongoDB/Stripe/SMTP (trusted dependencies)**

### 2.3 Entry points
- Web base URL: `NEXT_PUBLIC_WEB_URL` (typically `https://talent.goeducateinc.org`)
- API base URL: `NEXT_PUBLIC_API_URL` (typically `https://api-talent.goeducateinc.org`)

---

## 3) Authentication, authorization, and session model

### 3.1 Token model
- API issues JWT bearer tokens at login.
- Web stores token locally and sends it via `Authorization: Bearer <token>`.

### 3.2 API RBAC enforcement
Implemented in `apps/api/src/middleware/auth.ts`:
- `requireAuth`: verifies token and populates `req.user`
- `requireRole([roles...])`: rejects requests not in allowed role set
- `maybeAuth`: attaches `req.user` if token valid; otherwise continues anonymous (for public read endpoints)

### 3.3 Web behavior on auth failure
Implemented in `apps/web/lib/api.ts`:
- On **401**, the browser dispatches a toast: “Session expired… Please sign in again.”
- Web may redirect to login via UI guards; API remains authoritative.

### 3.4 Account recovery (security-sensitive)
See routes in `apps/api/src/routes/auth.ts` and doc `docs/AUTH_RECOVERY.md`:
- Username reminder via email and/or security questions
- Password reset token generation:
  - 32-byte random token
  - Stored hashed in Mongo (SHA-256)
  - 60-minute expiry
  - Single-use semantics
- Security question answers stored as bcrypt hashes; recovery endpoints return generic `{ ok: true }` to reduce enumeration risk.

---

## 4) Data inventory and classification

### 4.1 Data classification levels
- **Public**: content intended for unauthenticated consumption (e.g., published KB articles)
- **Internal**: operational metadata not meant for end users (queue ages, assignment notes)
- **Confidential**: PII and user account data (emails, names, profiles, messages)
- **Restricted**: authentication secrets and security artifacts (password hashes, reset token hashes, security answer hashes)

### 4.2 Primary collections (models)
| Model | File | Classification | Notes |
|---|---|---|---|
| User | `apps/api/src/models/User.ts` | Confidential/Restricted | passwordHash, reset token hash, recovery answers |
| PlayerProfile | `apps/api/src/models/PlayerProfile.ts` | Confidential | PII + athletic info; includes public visibility flags |
| CoachProfile | `apps/api/src/models/CoachProfile.ts` | Confidential | PII + institution info |
| EvaluatorProfile | `apps/api/src/models/EvaluatorProfile.ts` | Confidential | PII + credentials/location |
| FilmSubmission | `apps/api/src/models/FilmSubmission.ts` | Confidential | videoUrl/cloudinaryPublicId, notes |
| EvaluationReport | `apps/api/src/models/EvaluationReport.ts` | Confidential | rubric, evaluator identity |
| Notification | `apps/api/src/models/Notification.ts` | Internal/Confidential | may include player names/metadata |
| Watchlist | `apps/api/src/models/Watchlist.ts` | Internal | links coach→player |
| Conversation / Message | `apps/api/src/models/Conversation.ts`, `Message.ts` | Confidential | message text is sensitive |
| EmailAuditLog | `apps/api/src/models/EmailAuditLog.ts` | Internal/Confidential | to/subject/meta/errors |
| AdminAuditLog | `apps/api/src/models/AdminAuditLog.ts` | Internal | privileged actions trace |
| KB Article / History / Feedback | `KnowledgeBase*` | Public (published) / Internal (draft/history) | authored in Markdown |
| DailyActiveUser / AppEvent / Metrics* | metrics models | Internal | aggregated telemetry |

### 4.3 Data retention (current vs recommended)
**Current state**: no explicit TTL indices observed in models shown; retention is indefinite unless manually pruned.  
**Recommended** (policy decision):
- Email audit logs: retain **90–180 days** (keep failures longer if needed)
- Admin audit logs: retain **365+ days**
- AppEvent telemetry: retain **90–365 days**
- Messages: retain **per product policy** (e.g., 365 days), with deletion tooling

---

## 5) API error model

### 5.1 Standard error shape
Implemented in `apps/api/src/http/errors.ts`:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": { "optional": "payload" }
  }
}
```

### 5.2 Common status codes
- **400**: `BAD_REQUEST` (validation)
- **401**: `UNAUTHORIZED` (no/invalid token)
- **403**: `FORBIDDEN` (insufficient role)
- **404**: `NOT_FOUND`
- **409**: conflict (e.g., already exists)
- **429**: `RATE_LIMITED`
- **500**: `INTERNAL_SERVER_ERROR`

---

## 6) Observability and auditability

### 6.1 Request logging
`apps/api/src/middleware/requestLogger.ts`:
- Adds `x-request-id`
- Logs JSON per request:
  - method, path, status, durationMs, userId, role
- Avoids logging bodies and auth headers

### 6.2 Deployment version stamping
`apps/api/src/server.ts`:
- Adds `x-goeducate-commit` header to all responses for deployment validation

### 6.3 Admin audit logging
`apps/api/src/audit/adminAudit.ts`:
- Stores actorUserId, action, targetType/Id, ip, userAgent, meta
- Best-effort (failure does not block request)

### 6.4 Email audit logging
`apps/api/src/models/EmailAuditLog.ts`:
- Tracks type/status/to/subject/from/cc/bcc and related entity ids
- Stores `meta` and `error` payloads (sensitive; handle with care)

---

## 7) Rate limiting

### 7.1 Implementation
`apps/api/src/middleware/rateLimit.ts`:
- In-memory buckets keyed by `keyPrefix:ip`
- Returns 429 with `RATE_LIMITED`

### 7.2 Notable configured limits (non-exhaustive)
- Auth:
  - login: 25 / 15 min (`auth_login`)
  - register: 10 / 60 min (`auth_register`)
  - recovery: 8 / 60 min (`auth_recovery`)
  - reset: 10 / 15 min (`auth_reset`)
  - security questions: 12 / 15 min (`auth_secq`)
- Admin:
  - email actions: 30 / 5 min (`admin_email`)
  - dangerous actions: 20 / 10 min (`admin_danger`)
- Film queue ops:
  - assignment/status limiters in `apps/api/src/routes/filmSubmissions.ts`

**Risk note**: in-memory rate limiting is per-instance; distributed deployments should migrate to Redis or equivalent to ensure consistent enforcement.

---

## 8) Endpoint catalog (audit-grade)

### 8.1 Conventions
- All endpoints are rooted at API base URL.
- Authentication via `Authorization: Bearer <token>`.
- Unless noted, requests/responses are JSON.

### 8.2 Authentication and account security (`apps/api/src/routes/auth.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/auth/me` | Yes | Any | returns current user identity summary |
| POST | `/auth/login` | No | N/A | supports email or username login |
| POST | `/auth/register` | No | N/A | public roles: player/coach only |
| POST | `/auth/forgot-username` | No | N/A | generic ok; sends email if configured |
| POST | `/auth/forgot-password` | No | N/A | generic ok; creates reset token if user exists |
| GET | `/auth/reset-password/validate` | No | N/A | validates reset token |
| POST | `/auth/reset-password` | No | N/A | sets new password, token single-use |
| POST | `/auth/change-password` | Yes | Any | requires current password |
| GET | `/auth/recovery-questions/me` | Yes | Any | returns configured questions (no answers) |
| PUT | `/auth/recovery-questions/me` | Yes | Any | set/replace questions (requires current password) |
| POST | `/auth/recover/username` | No | N/A | generic ok; verifies security answers best-effort |
| POST | `/auth/recover/password` | No | N/A | generic ok; verifies answers then emails reset |

### 8.3 Profiles (`apps/api/src/routes/profiles.ts`, `playerProfiles.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/profiles/me` | Yes | Any | auto-creates blank coach/evaluator profiles if missing |
| PUT | `/profiles/me` | Yes | Any | updates role-specific profile |
| GET | `/profiles/player/:userId` | Optional | Any | public shaping based on requester |
| GET | `/profiles/coach/:userId` | Optional | Any | public shaping based on requester |
| GET | `/profiles/evaluator/:userId` | Optional | Any | public shaping based on requester |

### 8.4 Film submissions (`apps/api/src/routes/filmSubmissions.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| POST | `/film-submissions` | Yes | Player | requires `videoUrl` or `cloudinaryPublicId` |
| GET | `/film-submissions/me` | Yes | Player | list player’s submissions |
| GET | `/film-submissions/player/:userId` | Yes | Coach/Admin/Evaluator | list for a player |
| GET | `/film-submissions/queue` | Yes | Evaluator/Admin | supports `mine=1`, `overdueOnly=1`; adds `ageHours`, `isOverdue` |
| PATCH | `/film-submissions/:id/status` | Yes | Evaluator/Admin | status transitions; rate limited |
| PATCH | `/film-submissions/:id/assignment` | Yes | Admin/Evaluator | supports assignment note; audited |

### 8.5 Evaluations (`apps/api/src/routes/evaluations.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| POST | `/evaluations` | Yes | Evaluator/Admin | creates `EvaluationReport`; marks film completed; emails player with ops BCC; notifies subscribed watchlist coaches |

### 8.6 Notifications (`apps/api/src/routes/notifications.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/notifications/me` | Yes | Any | supports `unreadOnly=1` |
| GET | `/notifications/unread-count` | Yes | Any | count of unread |
| PATCH | `/notifications/:id/read` | Yes | Any | mark one as read |
| PATCH | `/notifications/me/read` | Yes | Any | bulk mark read |
| DELETE | `/notifications/:id` | Yes | Any | delete one |
| DELETE | `/notifications/me` | Yes | Any | bulk delete |
| GET | `/notifications/stream` | Yes | Any | SSE unread updates |

### 8.7 Messaging (`apps/api/src/routes/messages.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/messages/recipients` | Yes | Player/Coach/Evaluator/Admin | typeahead, returns `userId`, `displayName`, `email` |
| GET | `/messages/conversations` | Yes | Player/Coach/Evaluator/Admin | includes per-conversation unread |
| GET | `/messages/conversations/:id` | Yes | Player/Coach/Evaluator/Admin | returns messages with sender metadata |
| POST | `/messages/conversations/:id/read` | Yes | Player/Coach/Evaluator/Admin | marks read for requester |
| GET | `/messages/stream` | Yes | Any | SSE unread updates |

### 8.8 Knowledge Base public (`apps/api/src/routes/kb.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/kb/search` | Optional | Any | published-only unless admin |
| GET | `/kb/articles/:slug` | Optional | Any | published-only unless admin |
| GET | `/kb/categories` | Optional | Any | published-only unless admin |
| GET | `/kb/tags` | Optional | Any | published-only unless admin |
| POST | `/kb/articles/:slug/feedback` | Yes | Any | “Was this helpful?” feedback |
| POST | `/kb/events` | Optional | Any | telemetry |

### 8.9 Knowledge Base admin (`apps/api/src/routes/adminKb.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/admin/kb/articles` | Yes | Admin | list with filters + pagination |
| GET | `/admin/kb/articles/:id` | Yes | Admin | detail |
| PUT | `/admin/kb/articles/:id` | Yes | Admin | update |
| POST | `/admin/kb/articles` | Yes | Admin | create |
| POST | `/admin/kb/articles/:id/publish` | Yes | Admin | publish |
| POST | `/admin/kb/articles/:id/unpublish` | Yes | Admin | unpublish |
| DELETE | `/admin/kb/articles/:id` | Yes | Admin | delete |
| GET | `/admin/kb/articles/:id/history` | Yes | Admin | history/audit |

### 8.10 Admin operations (`apps/api/src/routes/admin.ts`)
**Note**: `admin.ts` is large; endpoints include user management, evaluations queue, email diagnostics/resend, maps, audit logs, notifications admin queue, and invites.

Selected high-impact endpoints:
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| POST | `/admin/bootstrap` | No (keyed) | N/A | one-time admin creation, guarded by bootstrap key |
| GET | `/admin/evaluations` | Yes | Admin | paginated list + queue KPIs + overdue flags |
| GET | `/admin/evaluations/film/:filmSubmissionId` | Yes | Admin | evaluation detail view (report + rubric + evaluator) |
| GET | `/admin/evaluations/workload` | Yes | Admin | per-evaluator workload dashboard |
| GET | `/admin/email/config` | Yes | Admin | smtp/stripe configured status |
| GET | `/admin/email/audit` | Yes | Admin | email audit log w/ filters |
| POST | `/admin/email/resend` | Yes | Admin | resend supported types |
| POST | `/admin/email/digest` | Yes | Admin | ops digest email |
| GET | `/admin/users` | Yes | Admin | list/search |
| PATCH | `/admin/users/:id` | Yes | Admin | edit identity + role + subscription + profile visibility |
| DELETE | `/admin/users/:id` | Yes | Admin | dangerous action; rate limited + audited |
| GET | `/admin/audit-logs` | Yes | Admin | view admin audit logs |

### 8.11 Billing (`apps/api/src/routes/billing.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/billing/status` | Yes | Coach | returns plan type + renewal date + downgrade scheduled |
| POST | `/billing/checkout` | Yes | Coach | starts checkout session |
| POST | `/billing/portal` | Yes | Coach | opens billing portal |
| POST | `/billing/downgrade-monthly` | Yes | Coach | schedules annual→monthly at renewal |

### 8.12 Metrics (`apps/api/src/routes/adminMetrics.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/admin/metrics/config` | Yes | Admin | thresholds/targets |
| PUT | `/admin/metrics/config` | Yes | Admin | update thresholds/targets |
| GET | `/admin/metrics/summary` | Yes | Admin | KPI rollups |
| GET | `/admin/metrics/trends` | Yes | Admin | time series |
| POST | `/admin/metrics/email-snapshot` | Yes | Admin | email KPI snapshot |
| GET | `/admin/metrics/drilldown/funnel` | Yes | Admin | funnel drilldown |

### 8.13 Health (`apps/api/src/routes/health.ts`)
| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET | `/health` | No | N/A | includes Railway commit/environment/service |

---

## 9) Access control matrix (role × capability)

### 9.1 Roles
Roles are defined in shared constants (`@goeducate/shared`):
- Player
- Coach
- Evaluator
- Admin

### 9.2 Capability matrix (high-level)
| Capability | Player | Coach | Evaluator | Admin |
|---|:---:|:---:|:---:|:---:|
| Register | ✓ | ✓ | ✗ | ✗ (bootstrap/admin create) |
| Login | ✓ | ✓ | ✓ | ✓ |
| Manage own profile | ✓ | ✓ | ✓ | ✓ |
| Submit film | ✓ | ✗ | ✗ | ✗ |
| View own film status | ✓ | ✗ | ✗ | ✓ (all) |
| Evaluation queue | ✗ | ✗ | ✓ | ✓ |
| Submit evaluation report | ✗ | ✗ | ✓ | ✓ |
| View player evaluation report | ✓ (own) | ✓ (if permitted) | ✓ | ✓ |
| Coach search | ✗ | ✓ | ✓ (search support) | ✓ |
| Watchlist | ✗ | ✓ | ✗ | ✓ |
| Request contact | ✗ | ✓ (gated) | ✗ | ✓ |
| Messaging | ✓ | ✓ | ✓ | ✓ |
| KB read | ✓ | ✓ | ✓ | ✓ |
| KB author/publish | ✗ | ✗ | ✗ | ✓ |
| Admin email diagnostics/resend | ✗ | ✗ | ✗ | ✓ |
| Metrics | ✗ | ✗ | ✗ | ✓ |
| User management | ✗ | ✗ | ✗ | ✓ |

---

## 10) Security model (threats and mitigations)

### 10.1 Threat model summary
| Threat | Surface | Likelihood | Impact | Mitigations (current) | Gaps / Recommendations |
|---|---|---:|---:|---|---|
| Credential stuffing | `/auth/login` | Med | High | rate limit + hashed passwords | add WAF / IP reputation; add MFA optional |
| User enumeration | recovery endpoints | Med | Med | generic `{ ok: true }`; dummy compare | add consistent response timing monitoring |
| Token theft | browser storage | Med | High | short sessions not specified; 401 UX | consider httpOnly cookies; rotate secrets |
| Privilege escalation | admin endpoints | Low | High | RBAC middleware; audit logs | add stronger admin action approvals for deletes |
| Email injection | SMTP templates | Low | Med | escape helpers | add DKIM/SPF/DMARC verification and bounce handling |
| XSS in KB | KB article rendering | Med | High | (frontend uses sanitization stack) | ensure sanitization remains enforced + add CSP |
| Data leakage (IDs) | UI rendering | Med | Med | hiding IDs in user-facing views | enforce systematic “public shaping” utilities everywhere |
| Abuse / spam messaging | messaging endpoints | Med | Med | request/accept flow; recipient restrictions | add per-user rate limit + abuse reporting |

### 10.2 Secrets handling
- JWT secret is required in production (`apps/api/src/env.ts`).
- SMTP/Stripe secrets are env vars; access restricted to deploy environment.
- Password hashes and recovery answers are stored hashed (bcrypt).
- Reset tokens stored hashed (SHA-256).

---

## 11) Reliability and resiliency

### 11.1 Web API call resiliency
`apps/web/lib/api.ts`:
- Default timeout: **15s**
- Retries: default **1** (up to 4)
- Retries on: 502/503/504; optional retry on 404 for split-rollout mitigation

### 11.2 API startup resiliency (Railway)
`apps/api/src/server.ts`:
- starts listening before Mongo connection completes
- retries Mongo connection with backoff
- binds to injected port and also 8080 fallback
- response headers include commit SHA

---

## 12) Operational runbooks (Level 3)

### 12.1 “API deployment looks stale / mixed versions”
**Symptoms**
- Some endpoints return 404/403 but others work.
- UI intermittently fails, then succeeds on retry.

**Actions**
1. Hit `GET /health` and check `railway.gitCommitSha`.
2. Confirm API responses include header `x-goeducate-commit`.
3. If mixed versions persist >10 minutes:
   - redeploy the service
   - verify `PORT` env var is not empty-string
4. Temporary mitigation: enable `retryOn404` in affected web calls (already used for some admin UIs).

### 12.2 “Emails failing”
**Actions**
1. Go to `/admin/email` and filter failures (24h).
2. Confirm SMTP config shows configured.
3. Use resend if supported; if not, read the “why not” reason (missing metadata, etc.).
4. If failures are systemic: check SMTP credentials, provider status, and Railway logs for auth errors.

### 12.3 “Evaluation backlog growing / overdue spike”
**Actions**
1. Go to `/admin/evaluations`
2. Toggle **overdue only**
3. Use `/admin/evaluations/workload` to identify overloaded evaluators
4. Reassign in bulk with assignment notes
5. If persistent: review SLA threshold and evaluator staffing

### 12.4 “Messaging unread badge incorrect”
**Actions**
1. Confirm `/messages/stream` is reachable (auth required).
2. If streaming fails, ensure polling fallback is active (header refresh).
3. Have user open conversation; it should call mark-read and dispatch `goeducate:messages-changed`.

---

## 13) Configuration and environment variables (API)

Validated in `apps/api/src/env.ts` (selected):
- Core: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`
- Email: `SMTP_*`, `INVITE_FROM_EMAIL`, `WEB_APP_URL`, `SUBMISSION_ALERT_EMAILS`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`
- Uploads: `UPLOADS_DIR`
- Contact routing: `CONTACT_TO_EMAIL` (default `info@goeducateinc.org`)

---

## 14) Compliance checklist mapping (implementation-focused)

This section maps common audit control themes to what exists today.

| Control theme | Current implementation | Gaps / Next steps |
|---|---|---|
| Access control | API RBAC + auth middleware | add admin MFA and least-privilege admin roles |
| Audit logging | AdminAuditLog + request logging | add immutable log export + retention policy |
| Incident response | runbooks (this doc) | add on-call rota + alerting integration |
| Data retention | not enforced in DB | add TTL indices + policy approval |
| Backup/restore | platform-dependent | document Mongo backups + test restore |
| Vulnerability mgmt | dependency updates | add automated scanning CI |

---

## 15) Appendices

### Appendix A — Key source files (traceability)
- API entry: `apps/api/src/server.ts`
- Env validation: `apps/api/src/env.ts`
- Auth/RBAC: `apps/api/src/middleware/auth.ts`
- Error shape: `apps/api/src/http/errors.ts`
- Rate limit: `apps/api/src/middleware/rateLimit.ts`
- Request log: `apps/api/src/middleware/requestLogger.ts`
- Core routes: `apps/api/src/routes/*`
- Web API client: `apps/web/lib/api.ts`


