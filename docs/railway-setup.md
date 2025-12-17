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
- Set the **Root Directory** to `apps/api`
- Set environment variables:
  - **MONGODB_URI**: use the Mongo connection string from the MongoDB service
  - **JWT_SECRET**: generate a long random secret (at least 32 chars)
  - **CORS_ORIGIN**: your web URL, for example `https://talent.goeducateinc.org`
  - **PORT**: Railway sets this automatically on many templates; if needed set `PORT=4000`
- Health check:
  - Endpoint: `/health`

### 3) Create the Web service (apps/web)

- In the same Railway project, click **Add** → **Service** → **GitHub Repo**
- Select this repo (again)
- Set the **Root Directory** to `apps/web`
- Set environment variables:
  - **NEXT_PUBLIC_API_URL**: your deployed API base URL, for example `https://api-talent.goeducateinc.org`

### 4) Domains

- For web: set custom domain to `talent.goeducateinc.org`
- For API: set custom domain to `api-talent.goeducateinc.org`

### 5) Local development with Railway MongoDB (optional)

- Copy `apps/api/env.example` → `apps/api/.env`
- Set `MONGODB_URI` to the Railway Mongo connection string
- Run:
  - `npm install`
  - `npm run dev`


