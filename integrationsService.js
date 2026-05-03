// ============================================================
// src/services/integrationsService.js  (Frontend — Netlify)
// Calls: Vercel backend  /api/v1/integrations/[action]
// Jira & Azure credentials sent to server — never exposed in browser
// ============================================================

import { SERVICES } from '../config/services';
import { tokenStore } from './authService';

const BASE = `${SERVICES.integrations.BASE_URL}/api/${SERVICES.integrations.version}/integrations`;

async function apiFetch(path, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/${path}`, {
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

export const integrationsService = {

  // ── Jira ──────────────────────────────────────────────────
  async importFromJira(jiraConfig) {
    const data = await apiFetch('jira-import', {
      method: 'POST',
      body: {
        jiraUrl:    jiraConfig.url,
        email:      jiraConfig.email,
        apiToken:   jiraConfig.apiToken,
        projectKey: jiraConfig.projectKey,
      },
    });
    // Normalise to shape expected by App.jsx
    return data.tests.map(t => ({
      id:       t.test_case_key || t.dbKey,
      name:     t.summary,
      type:     t.type || 'api',
      priority: t.priority || 'High',
      jiraKey:  t.jiraKey,
    }));
  },

  async exportToJira(jiraConfig, tests) {
    if (!tests.length) throw new Error('No test cases to export');
    const data = await apiFetch('jira-export', {
      method: 'POST',
      body: {
        jiraUrl:    jiraConfig.url,
        email:      jiraConfig.email,
        apiToken:   jiraConfig.apiToken,
        projectKey: jiraConfig.projectKey,
        tests,
      },
    });
    return data.tests;
  },

  // ── Azure DevOps ──────────────────────────────────────────
  async importFromAzure(azureConfig) {
    const data = await apiFetch('azure-import', {
      method: 'POST',
      body: {
        organization: azureConfig.organization,
        project:      azureConfig.project,
        pat:          azureConfig.pat,
      },
    });
    return data.tests.map(t => ({
      id:       t.test_case_key || `AZURE-${t.azureId}`,
      name:     t.summary,
      type:     t.type || 'api',
      priority: t.priority || 'High',
      azureId:  t.azureId,
    }));
  },

  async exportToAzure(azureConfig, tests) {
    if (!tests.length) throw new Error('No test cases to export');
    const data = await apiFetch('azure-export', {
      method: 'POST',
      body: {
        organization: azureConfig.organization,
        project:      azureConfig.project,
        pat:          azureConfig.pat,
        tests,
      },
    });
    return data.tests;
  },

  // ── CSV (runs entirely in browser — no server call needed) ─
  parseCSV(text) {
    const lines = text.split('\n');
    if (lines.length < 2) throw new Error('CSV has no data rows');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const idx = key => headers.findIndex(h => h.includes(key));
    const idI   = idx('id');
    const nameI = idx('title') !== -1 ? idx('title') : idx('name');
    const descI = idx('description');
    const typeI = idx('type');
    const priI  = idx('priority');
    const VALID = ['unit', 'api', 'database', 'performance', 'security', 'ui'];
    return lines.slice(1).filter(l => l.trim()).map((line, i) => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const rawType = vals[typeI]?.toLowerCase() || 'unit';
      return {
        id:          vals[idI]   || `TC-CSV-${Date.now()}-${i}`,
        name:        vals[nameI] || `Imported Test ${i + 1}`,
        description: vals[descI] || '',
        priority:    vals[priI]  || 'Medium',
        type:        VALID.includes(rawType) ? rawType : 'unit',
      };
    });
  },

  getCSVTemplate() {
    const rows = [
      ['Test Case ID', 'Title', 'Description', 'Type', 'Priority', 'Preconditions', 'Test Steps', 'Expected Result'],
      ['TC-001', 'Sample API Test', 'Test the login API endpoint', 'api', 'High', 'API running', 'POST /login | Verify 200', 'Token returned'],
      ['TC-002', 'Sample UI Test', 'Homepage loads correctly', 'ui', 'Medium', 'Browser launched', 'Navigate to / | Check elements', 'All visible'],
      ['TC-003', 'SQL Injection', 'Test for SQL injection', 'security', 'Critical', 'DB accessible', "Inject ' OR 1=1 | Verify blocked", 'Input sanitized'],
    ];
    return rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  },
};
