## GoEducate High School Football Talent Evaluation Platform

Monorepo:

- `apps/api`: Express + TypeScript + MongoDB API (JWT auth + RBAC)
- `apps/web`: Next.js 15 App Router web app
- `packages/shared`: shared types + Zod schemas

### Prerequisites

- Node.js 20+ and npm 10+
- MongoDB (local) or Railway MongoDB (recommended for hosted)

### Local setup

- **Install**
  - `npm install`
- **Environment**
  - Copy `apps/api/env.example` to `apps/api/.env`
  - Copy `apps/web/env.example` to `apps/web/.env.local`
- **Run**
  - `npm run dev`
  - Web: `http://localhost:3000`
  - API: `http://localhost:4000/health`

### Railway setup

See `docs/railway-setup.md`.


