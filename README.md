# Professional Testing Framework
## Micro-Service Architecture + Google AdSense

---

## 📁 Project Structure

```
src/
├── config/
│   └── services.js          ← UPDATE THIS per deployment environment
│
├── services/                ← Each file = independently deployable service
│   ├── authService.js       → Auth microservice  (port 3001)
│   ├── testEngineService.js → Test Engine        (port 3002)
│   ├── bugTrackerService.js → Bug Tracker        (port 3003)
│   ├── integrationsService.js → Jira + Azure     (port 3004)
│   └── reportingService.js  → Export / Reports   (port 3005)
│
├── components/
│   └── ads/
│       └── GoogleAdUnit.jsx ← AdSense drop-in component
│
└── App.jsx                  ← Main orchestrator (thin UI shell)
```

---

## 🚀 Deploying Services Independently

### Step 1 — Update `src/config/services.js`

Each service has its own `BASE_URL`. Set via environment variables:

```bash
# .env.production
REACT_APP_AUTH_SERVICE_URL=https://auth.yourapp.com
REACT_APP_TEST_ENGINE_URL=https://engine.yourapp.com
REACT_APP_BUG_TRACKER_URL=https://bugs.yourapp.com
REACT_APP_INTEGRATIONS_URL=https://integrations.yourapp.com
REACT_APP_REPORTING_URL=https://reports.yourapp.com
```

### Step 2 — Replace simulated calls with real fetch()

Each `service.js` file has `TODO` comments. Example in `authService.js`:

```javascript
// BEFORE (simulated):
await simulateDelay(1000);
return { token: 'mock-jwt', user: { ... } };

// AFTER (real backend):
const res = await fetch(`${BASE}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!res.ok) throw new Error(await res.text());
return res.json();
```

### Step 3 — Deploy each service

You can host each service independently:

| Service         | Recommended hosting           | Trigger for update              |
|----------------|------------------------------|---------------------------------|
| Auth            | Vercel / Railway / AWS Lambda | User signup/login flow changes  |
| Test Engine     | AWS EC2 / GCP Run             | Test generation logic updates   |
| Bug Tracker     | Railway / Render              | Jira webhook or schema changes  |
| Integrations    | Cloudflare Workers            | Jira/Azure API version changes  |
| Reporting       | Vercel Edge Functions         | Export format changes           |
| Frontend (App)  | Vercel / Netlify / S3+CF      | UI changes                      |

**None of the services require the others to redeploy** — they communicate only via HTTP.

---

## 📢 Google AdSense Integration

### Step 1 — Get your Publisher ID and Ad Slot IDs

1. Sign up at https://www.google.com/adsense/
2. Get your Publisher ID: `ca-pub-XXXXXXXXXXXXXXXXX`
3. Create ad units in the AdSense dashboard. You'll get slot IDs per unit.

### Step 2 — Set environment variables

```bash
# .env.production
REACT_APP_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXXX
REACT_APP_AD_SLOT_HEADER=1234567890        # Leaderboard (728x90)
REACT_APP_AD_SLOT_SIDEBAR_TOP=0987654321   # Rectangle (300x250)
REACT_APP_AD_SLOT_SIDEBAR_BOT=1122334455   # Rectangle (300x250)
REACT_APP_AD_SLOT_INFEED=5566778899        # In-feed / native
REACT_APP_AD_SLOT_RESULTS=9988776655       # Results panel
REACT_APP_AD_SLOT_UPGRADE=4433221100       # Upgrade banner
```

### Step 3 — AdSense only loads in production

`ADSENSE_CONFIG.enabled` is `true` only when `NODE_ENV === 'production'`.  
In dev, you see labeled yellow placeholder boxes instead.

### Step 4 — Ad placements in the UI

| Slot key        | Location                    | Format     | Shown to     |
|----------------|----------------------------|-----------|-------------|
| `headerBanner`  | Top of page                 | Horizontal | Free users  |
| `sidebarTop`    | Above results panel         | Rectangle  | Free users  |
| `sidebarBottom` | Below results panel         | Rectangle  | Free users  |
| `inFeed`        | Between test list & results | Horizontal | Free users  |

**Pro and Enterprise users see zero ads** (`PLANS[plan].showAds === false`).

### Step 5 — Add the script tag to `public/index.html` (optional)

Instead of the `<AdSenseScript />` component, you can hardcode in `index.html`:

```html
<script async 
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXXX"
  crossorigin="anonymous">
</script>
```

---

## 🔄 How to Update a Single Service

Example: updating only the **Bug Tracker** service (e.g., new Jira API version):

```bash
cd src/services
# Edit bugTrackerService.js only
git add bugTrackerService.js
git commit -m "fix: update Jira API to v3"
git push origin main
# Deploy ONLY the bug tracker backend — no other service touched
```

The frontend (`App.jsx`) doesn't change because it calls `bugTrackerService.createBug()` —  
the contract (function signature + return shape) stays the same.

---

## 💰 Monetization Flow

```
User visits → Free plan → Sees ads → Hits test limit → Upgrade prompt
                                                           ↓
                                              Selects Pro ($29/mo)
                                                           ↓
                                        authService.upgradePlan() called
                                                           ↓
                                         Ads disappear, limits lifted
```

---

## 📦 Install & Run

```bash
npm install
npm start           # dev (AdSense placeholders visible)
npm run build       # production (real AdSense loads)
```

## Environment Files

```
.env.development    → local service URLs (localhost:3001 etc.)
.env.production     → deployed service URLs + real AdSense IDs
.env.staging        → staging URLs (optional)
```
