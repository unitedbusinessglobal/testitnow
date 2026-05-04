// ============================================================
// src/services/authService.js  (Frontend — Netlify)
// Calls: Vercel backend  /api/v1/auth/[action]
// Neon tables: users, subscription_plans
// ============================================================

import { SERVICES } from '../config/services';

const BASE = `${SERVICES.auth.BASE_URL}/api/${SERVICES.auth.version}/auth`;

// ── Token storage ─────────────────────────────────────────────
const TOKEN_KEY = 'testitnow_token';
export const tokenStore = {
  get:   ()      => localStorage.getItem(TOKEN_KEY),
  set:   (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: ()      => localStorage.removeItem(TOKEN_KEY),
};

// ── Shared fetch helper ───────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// ── Public API ────────────────────────────────────────────────
export const authService = {
  async login(email, password) {
    const data = await apiFetch('login', { method: 'POST', body: { email, password } });
    tokenStore.set(data.token);
    return data;
  },

  async signup(email, password, phone) {
    const data = await apiFetch('signup', {
      method: 'POST',
      body: { email, password, phone: phone || undefined, fullName: email.split('@')[0] },
    });
    tokenStore.set(data.token);
    return data;
  },

  async logout() {
    try { await apiFetch('logout', { method: 'POST' }); } finally { tokenStore.clear(); }
    return { success: true };
  },

  async getProfile() {
    const token = tokenStore.get();
    if (!token) return null;
    try { const data = await apiFetch('me', { method: 'GET' }); return data.user; }
    catch { tokenStore.clear(); return null; }
  },

  async upgradePlan(_, planId) {
    const data = await apiFetch('upgrade', { method: 'POST', body: { planId } });
    if (data.token) tokenStore.set(data.token);
    return data;
  },

  isLoggedIn: () => Boolean(tokenStore.get()),
};
