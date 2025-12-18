## Railway setup (MongoDB + API + Web)

This repo is a monorepo with:

- `apps/api` (Express)
- `apps/web` (Next.js)

### 1) Create MongoDB on Railway

- In Railway, create a **New Project**
- Click **Add** → **Database** → **MongoDB**
- After it provisions, open the MongoDB service and copy the connection string:
  - Railway typically exposes this as an env var like `MONGO_URL` or `MONGODB_URI` (name can vary)

**Security note:** Do not paste real connection strings (with credentials) into documentation or commit them to git.
Use Railway environment variables instead.

Example variables you may see in Railway (names vary by template):

- `MONGO_URL`: `mongodb://<user>:<password>@mongodb.railway.internal:27017`
- `MONGO_PUBLIC_URL`: `mongodb://<user>:<password>@<public-host>:<public-port>`

### 2) Create the API service (apps/api)

- In the same Railway project, click **Add** → **Service** → **GitHub Repo**
- Select this repo
- **Important (monorepo):** set the **Root Directory** to the **repo root** (do not set it to `apps/api`).
  - If Railway runs `npm install` inside `apps/api`, it will try to download `@goeducate/shared` from npm and fail.
- Set environment variables:
  - **MONGODB_URI**: use the Mongo connection string from the MongoDB service
  - **JWT_SECRET**: generate a long random secret (at least 32 chars)
  - **BOOTSTRAP_ADMIN_KEY** (optional): set temporarily to bootstrap the first admin, then remove it
  - **CORS_ORIGIN**: comma-separated list of allowed origins. It must include the **exact** web origin you are loading the site from.
    - Example (Railway web URL + production domain):
      - `https://secure-strength-production.up.railway.app,https://talent.goeducateinc.org`
  - **PORT**: Railway sets this automatically on many templates; if needed set `PORT=4000`
- Set commands (Service Settings → Deploy):
  - **Build Command**: `npm ci && npm run build -w @goeducate/shared && npm run build -w @goeducate/api`
  - **Start Command**: `npm run start -w @goeducate/api`
- Health check:
  - Endpoint: `/health`

### 3) Create the Web service (apps/web)

- In the same Railway project, click **Add** → **Service** → **GitHub Repo**
- Select this repo (again)
- **Important (monorepo):** set the **Root Directory** to the **repo root** (do not set it to `apps/web`).
- Set environment variables:
  - **NEXT_PUBLIC_API_URL**: your deployed API base URL, for example `https://api-talent.goeducateinc.org`
- Set commands (Service Settings → Deploy):
  - **Build Command**: `npm ci && npm run build -w @goeducate/shared && npm run build -w @goeducate/web`
  - **Start Command**: `npm run start -w @goeducate/web`
  - Note: Railway sets `PORT` automatically. The web app must bind to `$PORT`.

### 4) Domains

- For web: set custom domain to `talent.goeducateinc.org`
- For API: set custom domain to `api-talent.goeducateinc.org`

### 5) Local development with Railway MongoDB (optional)

- Copy `apps/api/env.example` → `apps/api/.env`
- Set `MONGODB_URI` to the Railway Mongo connection string
- Run:
  - `npm install`
  - `npm run dev`

### Bootstrapping your first admin user (recommended)

1) Temporarily set API env var **`BOOTSTRAP_ADMIN_KEY`** to a long random value.
2) Call:

- `POST /admin/bootstrap` with header `x-bootstrap-key: <BOOTSTRAP_ADMIN_KEY>` and JSON body:
  - `{ "email": "admin@yourdomain.com", "password": "yourStrongPassword123!" }`

3) Remove `BOOTSTRAP_ADMIN_KEY` from the Railway API service after the admin is created.


