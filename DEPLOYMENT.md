# TestItNow — Full Stack Deployment Guide
## Neon PostgreSQL + Vercel Backend + Netlify Frontend

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER BROWSER                                │
│              (React SPA on Netlify CDN)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS API calls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VERCEL BACKEND                                │
│            (Serverless API Routes — Node 20)                    │
│                                                                 │
│  /api/v1/auth/[action]          ← authService.js               │
│  /api/v1/engine/[action]        ← testEngineService.js         │
│  /api/v1/bugs/[action]          ← bugTrackerService.js         │
│  /api/v1/integrations/[action]  ← integrationsService.js       │
│  /api/v1/reporting/[action]     ← reportingService.js          │
│  /api/v1/projects               ← project management           │
│  /api/health                    ← health check                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ @neondatabase/serverless
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NEON POSTGRESQL                                │
│          (Serverless Postgres — auto-suspend)                   │
│                                                                 │
│  users              subscription_plans   contact_requests       │
│  projects           test_cases                                  │
│  test_executions    bug_reports                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## STEP 1 — Set Up Neon PostgreSQL

### 1.1 Create a Neon Project
1. Go to **https://console.neon.tech** → Sign up (free tier available)
2. Click **"New Project"**
3. Name it `testitnow`, choose region closest to your users
4. Neon auto-creates a `main` branch and default database

### 1.2 Get Your Connection String
1. In the Neon Console → **Dashboard** → **Connection Details**
2. Select **"Pooled connection"** (required for serverless)
3. Copy the connection string — it looks like:
   ```
   postgresql://testitnow_owner:AbCdEfGh@ep-cool-name-123456.us-east-2.aws.neon.tech/testitnow?sslmode=require
   ```
4. Save it — you'll need it for both the migration and Vercel

### 1.3 Run the Database Migration
```bash
cd backend

# Install dependencies
npm install

# Create your local .env file
cp .env.example .env
# Edit .env and paste your DATABASE_URL

# Run migration (creates all tables + seeds plans)
node scripts/migrate.js
```

Expected output:
```
🔌 Connecting to Neon…
📦 Running schema migration…
🌱 Seeding subscription plans…
✅ Migration complete!
```

### 1.4 Verify in Neon Console
- Go to **Tables** tab → You should see:
  `users`, `projects`, `test_cases`, `test_executions`, `bug_reports`, `subscription_plans`, `contact_requests`

### 1.5 Enable Neon Branching (optional but recommended)
Neon supports Git-like database branches:
```bash
# Create a dev branch for safe development
# Do this in the Neon Console → Branches → New Branch
# Name it "development" — it gets its own connection string
```

---

## STEP 2 — Deploy Backend to Vercel

### 2.1 Install Vercel CLI
```bash
npm install -g vercel
vercel login
```

### 2.2 Initialize the Backend Project
```bash
cd backend
vercel
```

Follow the prompts:
- **Set up and deploy**: Yes
- **Which scope**: Your personal account or team
- **Link to existing project**: No → Create new
- **Project name**: `testitnow-backend`
- **Framework preset**: Other
- **Root directory**: `.` (current directory)
- **Build command**: (leave blank — no build step)
- **Output directory**: (leave blank)
- **Development command**: `vercel dev`

### 2.3 Set Environment Variables in Vercel

**Method A — Vercel Dashboard** (recommended for secrets):
1. Go to **vercel.com** → Your Project → **Settings** → **Environment Variables**
2. Add each variable from `backend/.env.example`:

| Variable | Value | Environments |
|----------|-------|--------------|
| `DATABASE_URL` | `postgresql://...` | Production, Preview, Development |
| `JWT_SECRET` | `openssl rand -base64 64` output | Production, Preview, Development |
| `JWT_EXPIRES_IN` | `7d` | All |
| `ALLOWED_ORIGINS` | `https://your-site.netlify.app` | Production |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Development |
| `NODE_ENV` | `production` | Production |

**Method B — Vercel CLI**:
```bash
vercel env add DATABASE_URL production
# Paste your Neon connection string when prompted

vercel env add JWT_SECRET production
# Paste your generated secret

vercel env add ALLOWED_ORIGINS production
# https://your-site.netlify.app
```

### 2.4 Deploy to Production
```bash
cd backend
vercel --prod
```

Output will give you a URL like: `https://testitnow-backend.vercel.app`

### 2.5 Verify the Backend
```bash
curl https://testitnow-backend.vercel.app/api/health
# Expected: {"status":"ok","db":"connected","ts":"..."}

# Test auth endpoint
curl -X POST https://testitnow-backend.vercel.app/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### 2.6 Update Individual API Routes (no full redeploy needed)
```bash
# Edit a single file, then deploy only that function:
vercel --prod --filter=api/v1/auth

# Or redeploy the whole backend:
vercel --prod
```

---

## STEP 3 — Deploy Frontend to Netlify

### 3.1 Install Netlify CLI
```bash
npm install -g netlify-cli
netlify login
```

### 3.2 Set Up the Frontend Repo
The frontend is the root of the project (where `package.json` and `netlify.toml` live).

```bash
# From project root:
npm install

# Test locally with API proxy to Vercel
REACT_APP_API_URL=https://testitnow-backend.vercel.app npm start
```

### 3.3 Update netlify.toml
Open `netlify.toml` and replace the proxy URL:
```toml
[[redirects]]
  from   = "/api/*"
  to     = "https://testitnow-backend.vercel.app/api/:splat"   # ← your Vercel URL
  status = 200
  force  = true
```

Also update the CSP header:
```toml
connect-src 'self' https://testitnow-backend.vercel.app ...;
```

### 3.4 Initialize Netlify Site
```bash
netlify init
```

Follow prompts:
- **Create & configure a new site**: Yes
- **Team**: Your team
- **Site name**: `testitnow` (or leave blank for auto-generated)
- **Build command**: `npm run build`
- **Publish directory**: `build`

### 3.5 Set Environment Variables in Netlify

**Method A — Netlify Dashboard**:
1. **Site Settings** → **Environment Variables** → **Add a variable**
2. Add from `.env.production.example`:

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://testitnow-backend.vercel.app` |
| `REACT_APP_ADSENSE_PUBLISHER_ID` | `ca-pub-XXXXXXXXXXXXXXXXX` |
| `REACT_APP_AD_SLOT_HEADER` | Your AdSense slot ID |
| *(other ad slots)* | Your AdSense slot IDs |

**Method B — Netlify CLI**:
```bash
netlify env:set REACT_APP_API_URL https://testitnow-backend.vercel.app
netlify env:set REACT_APP_ADSENSE_PUBLISHER_ID ca-pub-XXXXXXXXXXXXXXXXX
```

### 3.6 Deploy to Production
```bash
netlify deploy --prod
```

Your frontend will be live at: `https://testitnow.netlify.app`

---

## STEP 4 — Connect Everything

### 4.1 Update CORS on Vercel
In Vercel Dashboard → Environment Variables, update `ALLOWED_ORIGINS`:
```
https://testitnow.netlify.app,http://localhost:3000
```
Redeploy: `cd backend && vercel --prod`

### 4.2 Update Netlify Redirect
In `netlify.toml`, make sure the proxy points to your exact Vercel URL, then:
```bash
netlify deploy --prod
```

### 4.3 Smoke Test the Full Stack
```bash
# 1. Register a user
curl -X POST https://testitnow-backend.vercel.app/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"real@test.com","password":"securePass123","fullName":"Test User"}'

# 2. Visit your Netlify URL and log in
open https://testitnow.netlify.app

# 3. Click "Analyze Website" → enter a URL → generate tests
# 4. Click "Run Tests" → verify results appear
# 5. Click "Export CSV" → verify files download
```

---

## STEP 5 — Ongoing Deployment Workflow

### Update Backend Only
```bash
cd backend
# edit api/v1/engine/[action].js
git add . && git commit -m "feat: improve test generation"
vercel --prod
# Done — frontend unchanged, no Netlify redeploy needed
```

### Update Frontend Only
```bash
# edit src/App.jsx or any component
git add . && git commit -m "feat: new dashboard layout"
netlify deploy --prod
# Done — backend unchanged, no Vercel redeploy needed
```

### Update Database Schema
```bash
cd backend
# Add ALTER TABLE statements to scripts/migrate.js
node scripts/migrate.js
# Neon applies changes immediately — no backend redeploy needed
# unless new columns are used in API routes
```

### Preview Deployments
Both platforms support preview deploys on branches:
```bash
# Vercel — auto-previews on every git push to non-main branches
# Netlify — preview deploys:
netlify deploy  # (without --prod) → creates a preview URL
```

---

## Environment Variables Quick Reference

### Vercel Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `JWT_SECRET` | ✅ | 64+ char random string |
| `JWT_EXPIRES_IN` | ✅ | e.g. `7d` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated allowed origins |
| `NODE_ENV` | ✅ | `production` |
| `STRIPE_SECRET_KEY` | ⬜ | When payments are added |

### Netlify Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | ✅ | Your Vercel backend URL |
| `REACT_APP_ADSENSE_PUBLISHER_ID` | ⬜ | AdSense publisher ID |
| `REACT_APP_AD_SLOT_*` | ⬜ | AdSense slot IDs |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `CORS error` in browser | `ALLOWED_ORIGINS` missing frontend URL | Update Vercel env var, redeploy |
| `401 Unauthorized` | JWT_SECRET mismatch or token expired | Verify JWT_SECRET is the same across redeploys |
| `503 Service Unavailable` on DB | Neon cold start on free tier | First request may take 1-2s — expected |
| AdSense not showing | `REACT_APP_ADSENSE_PUBLISHER_ID` not set | Add to Netlify env vars and redeploy |
| `Invalid URL` on analyze | Bad URL input | Ensure URL starts with `https://` |
| Build fails on Netlify | Missing env var | Check all `REACT_APP_*` vars are set |

---

## Free Tier Limits

| Service | Free Tier |
|---------|-----------|
| **Neon** | 0.5 GB storage, 190 compute hours/month, 1 project |
| **Vercel** | 100 GB bandwidth, 6,000 function invocations/day |
| **Netlify** | 100 GB bandwidth, 300 build minutes/month |

All three services are free for development and small production loads.
