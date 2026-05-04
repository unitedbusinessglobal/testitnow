// ============================================================
// src/config/services.js
// All services now live on ONE Vercel deployment.
// For independent scaling, set each URL to a separate Vercel project.
// ============================================================

const VERCEL_API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const SERVICES = {
  auth:         { name: 'Auth Service',         BASE_URL: VERCEL_API, version: 'v1' },
  testEngine:   { name: 'Test Engine Service',  BASE_URL: VERCEL_API, version: 'v1' },
  bugTracker:   { name: 'Bug Tracker Service',  BASE_URL: VERCEL_API, version: 'v1' },
  integrations: { name: 'Integrations Service', BASE_URL: VERCEL_API, version: 'v1' },
  reporting:    { name: 'Reporting Service',     BASE_URL: VERCEL_API, version: 'v1' },
};

export const ADSENSE_CONFIG = {
  publisherId: process.env.REACT_APP_ADSENSE_PUBLISHER_ID || 'ca-pub-XXXXXXXXXXXXXXXXX',
  slots: {
    headerBanner:  process.env.REACT_APP_AD_SLOT_HEADER      || '1234567890',
    sidebarTop:    process.env.REACT_APP_AD_SLOT_SIDEBAR_TOP  || '0987654321',
    sidebarBottom: process.env.REACT_APP_AD_SLOT_SIDEBAR_BOT  || '1122334455',
    inFeed:        process.env.REACT_APP_AD_SLOT_INFEED        || '5566778899',
    resultsPanel:  process.env.REACT_APP_AD_SLOT_RESULTS       || '9988776655',
    upgradeBanner: process.env.REACT_APP_AD_SLOT_UPGRADE       || '4433221100',
  },
  enabled: process.env.NODE_ENV === 'production',
};

export const PLANS = {
  free: {
    id: 'free', name: 'Free', price: 0,
    testRunsPerMonth: 5, maxTestsPerAnalysis: 10, showAds: true,
    features: ['5 test runs/month', 'Up to 10 tests per analysis', 'Basic export (CSV)', 'Community support'],
  },
  pro: {
    id: 'pro', name: 'Pro', price: 29,
    testRunsPerMonth: 100, maxTestsPerAnalysis: 500, showAds: false,
    features: ['100 test runs/month', '500+ tests per analysis', 'Jira & Azure integration', 'Excel export', 'Priority support'],
  },
  small_business: {
    id: 'small_business', name: 'Small Business', price: 99,
    testRunsPerMonth: 500, maxTestsPerAnalysis: 5000, showAds: false,
    features: ['500 test runs/month', '5000 tests per analysis', 'All integrations', '20 team members', 'SSO support'],
  },
  premium: {
    id: 'premium', name: 'Premium', price: null,
    testRunsPerMonth: Infinity, maxTestsPerAnalysis: Infinity, showAds: false,
    features: ['Unlimited runs', 'Unlimited tests', 'Dedicated support', 'Custom SLA', 'White labeling'],
  },
};
