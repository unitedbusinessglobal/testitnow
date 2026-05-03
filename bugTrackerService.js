// ============================================================
// src/services/bugTrackerService.js  (Frontend — Netlify)
// Calls: Vercel backend  /api/v1/bugs/[action]
// Neon tables: bug_reports
// ============================================================

import { SERVICES } from '../config/services';
import { tokenStore } from './authService';

const BASE = `${SERVICES.bugTracker.BASE_URL}/api/${SERVICES.bugTracker.version}/bugs`;

async function apiFetch(path, options = {}) {
  const token = tokenStore.get();
  const url = path ? `${BASE}/${path}` : BASE;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const bugTrackerService = {

  async createBug(_jiraConfig, bugData) {
    // jiraConfig kept for API compat; server handles Jira call internally
    const data = await apiFetch('create', {
      method: 'POST',
      body: {
        projectId:   bugData.projectId || null,
        testCaseId:  bugData.testCaseId || null,
        summary:     bugData.summary,
        description: bugData.description,
        severity:    bugData.severity,
        priority:    bugData.priority,
        screenshotUrl: bugData.screenshot
          ? '[screenshot captured on client]'
          : null,
      },
    });
    return data.bug;
  },

  async getBugs(filters = {}) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString();
    const data = await apiFetch(`list${params ? '?' + params : ''}`, { method: 'GET' });
    return data.bugs;
  },

  async updateStatus(bugId, newStatus) {
    const data = await apiFetch('update', {
      method: 'PATCH',
      body: { bugId, status: newStatus },
    });
    return data.bug;
  },
};
