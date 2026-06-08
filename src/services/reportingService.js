// ============================================================
// src/services/reportingService.js  (Frontend — Netlify)
// Calls: Vercel backend  /api/v1/reporting/[action]
// Neon tables: test_cases, test_executions, bug_reports
// ============================================================

import { SERVICES } from '../config/services';
import { tokenStore } from './authService';

const BASE = `${SERVICES.reporting.BASE_URL}/api/${SERVICES.reporting.version}/reporting`;

async function apiFetch(path, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function makeCSV(rows) {
  return '\uFEFF' + rows.map(r =>
    r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');
}

function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const reportingService = {

  async exportToCSV(tests, results, projectId) {
    let backendData = null;
    if (tokenStore.get()) {
      try {
        const params = projectId ? `?projectId=${projectId}` : '';
        backendData = await apiFetch(`export-data${params}`, { method: 'GET' });
      } catch {
        console.warn('[reportingService] Backend unavailable, using local data');
      }
    }

    // Test Cases CSV
    const tcRows = [['Test ID','Title','Description','Priority','Type','Status','Created By','Created At']];
    const tcSource = backendData?.testCases ||
      Object.entries(tests).flatMap(([type, list]) =>
        list.map(t => ({ id: t.id, name: t.name, description: t.description, priority: t.priority, type, status: 'Not Executed' }))
      );
    tcSource.forEach(tc => tcRows.push([
      tc.id || 'N/A', tc.name || tc.summary, tc.description || '',
      tc.priority || 'Medium', tc.type || '', tc.status || 'Not Executed',
      tc.createdBy || '', tc.createdAt ? new Date(tc.createdAt).toLocaleString() : '',
    ]));
    downloadCSV(makeCSV(tcRows), 'Test_Cases.csv');

    // Results CSV
    const resultSource = backendData?.executions || results;
    if (resultSource.length) {
      const resRows = [['Test ID','Title','Status','Duration (ms)','Environment','Browser','Timestamp','Error']];
      resultSource.forEach((r, i) => resRows.push([
        r.id || r.testKey || `TC-${i+1}`, r.name || r.test_name,
        (r.status || r.execution_status || '').toUpperCase(),
        r.duration || r.duration_ms || 0, r.env || r.environment || 'production',
        r.browser || 'chrome',
        r.timestamp || (r.created_at ? new Date(r.created_at).toLocaleString() : ''),
        r.error || r.error_message || '',
      ]));
      downloadCSV(makeCSV(resRows), 'Test_Results.csv');
    }

    // Bugs CSV
    const bugSource = backendData?.bugs || [];
    if (bugSource.length) {
      const bugRows = [['Bug Key','Summary','Severity','Priority','Status','Date']];
      bugSource.forEach(b => bugRows.push([
        b.key || b.jiraKey, b.summary, b.severity, b.priority, b.status,
        b.date ? new Date(b.date).toLocaleString() : '',
      ]));
      downloadCSV(makeCSV(bugRows), 'Bug_Reports.csv');
    }
  },

  async getSummary(projectId) {
    const params = projectId ? `?projectId=${projectId}` : '';
    return apiFetch(`summary${params}`, { method: 'GET' });
  },

  async getHistory(options = {}) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(options).filter(([, v]) => v))
    ).toString();
    return apiFetch(`execution-history${params ? '?' + params : ''}`, { method: 'GET' });
  },

  downloadScreenshot(dataUrl, testName) {
    const a = Object.assign(document.createElement('a'), {
      href: dataUrl,
      download: `${testName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`,
    });
    a.click();
  },

  downloadImportTemplate() {
    const rows = [
      ['Test Case ID','Title','Description','Type','Priority','Preconditions','Test Steps','Expected Result'],
      ['TC-001','Sample API Test','Test the login endpoint','api','High','API running','POST /login | Verify 200','Token returned'],
      ['TC-002','Sample UI Test','Homepage loads','ui','Medium','Browser open','Navigate | Check elements','All visible'],
      ['TC-003','SQL Injection','Test for SQL injection','security','Critical','DB accessible',"Inject ' OR 1=1 | Verify blocked",'Input sanitized'],
    ];
    downloadCSV(makeCSV(rows), 'test_cases_template.csv');
  },
};
