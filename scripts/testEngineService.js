// ============================================================
// src/services/testEngineService.js  (Frontend — Netlify)
// Calls: Vercel backend  /api/v1/engine/[action]
// Neon tables: test_cases, test_executions
// ============================================================

import { SERVICES } from '../config/services';
import { tokenStore } from './authService';

const BASE = `${SERVICES.testEngine.BASE_URL}/api/${SERVICES.testEngine.version}/engine`;

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

export const testEngineService = {

  // ── Analyze website + generate + persist test cases ────────
  async analyzeAndGenerate(url, authCredentials = null, onProgress) {
    // Fire progress ticks while the backend works
    const progressInterval = setInterval(() => {
      if (onProgress) onProgress(Math.min(90, Math.random() * 30 + 30), 'Analyzing…');
    }, 900);

    try {
      // Retrieve or create default project
      const projRes = await fetch(
        `${SERVICES.auth.BASE_URL}/api/${SERVICES.auth.version}/projects`,
        { headers: { Authorization: `Bearer ${tokenStore.get()}` } },
      );
      let projectId = null;
      if (projRes.ok) {
        const projData = await projRes.json();
        projectId = projData.projects?.[0]?.project_id || null;
      }
      // Auto-create project if none exists
      if (!projectId) {
        const createRes = await fetch(
          `${SERVICES.auth.BASE_URL}/api/${SERVICES.auth.version}/projects`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenStore.get()}`,
            },
            body: JSON.stringify({ projectName: new URL(url).hostname }),
          },
        );
        if (createRes.ok) {
          const d = await createRes.json();
          projectId = d.project?.project_id || null;
        }
      }

      if (onProgress) onProgress(10, 'Fetching website structure…');

      const data = await apiFetch('analyze', {
        method: 'POST',
        body: { url, projectId, authCredentials },
      });

      clearInterval(progressInterval);
      if (onProgress) onProgress(100, 'Complete!');

      return {
        domain: data.meta?.domain || new URL(url).hostname,
        generated: data.generated,
        meta: data.meta,
      };
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  },

  // ── Run a list of tests, stream results via callback ───────
  async runTests(testList, onTestComplete) {
    const data = await apiFetch('run', {
      method: 'POST',
      body: { tests: testList },
    });

    // Simulate streaming: fire callback for each result
    for (const result of data.results) {
      await new Promise(r => setTimeout(r, 120));
      // Generate a client-side screenshot placeholder
      result.screenshot = await captureScreenshot(result);
      if (onTestComplete) onTestComplete(result);
    }

    return data.results;
  },

  // ── Retest a single failed test ────────────────────────────
  async retestSingle(test) {
    const data = await apiFetch('retest', { method: 'POST', body: { test } });
    data.result.screenshot = await captureScreenshot(data.result);
    return data.result;
  },
};

// ── Client-side screenshot placeholder (canvas) ───────────────
async function captureScreenshot(test) {
  return new Promise(resolve => {
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 300;
      const ctx = canvas.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 400, 300);
      g.addColorStop(0, test.status === 'passed' ? '#064e3b' : '#450a0a');
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#94a3b8'; ctx.font = '11px monospace';
      ctx.fillText(`[${(test.type || 'TEST').toUpperCase()}] ${test.id || ''}`, 16, 28);
      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText((test.name || '').substring(0, 44), 16, 54);
      ctx.fillStyle = test.status === 'passed' ? '#4ade80' : '#f87171';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(test.status?.toUpperCase() || '', 16, 78);
      ctx.fillStyle = '#64748b'; ctx.font = '10px monospace';
      ctx.fillText(new Date().toLocaleString(), 16, 100);
      // Browser chrome mock
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
      ctx.strokeRect(16, 115, 368, 165);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(17, 116, 367, 22);
      ctx.fillStyle = '#475569'; ctx.font = '9px monospace';
      ctx.fillText('● ● ●   https://' + (test.url || 'example.com'), 26, 130);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(17, 139, 367, 140);
      [['#1e3a5f', 28, 149, 160, 55], ['#1e3a5f', 200, 149, 160, 55], ['#1e293b', 28, 215, 340, 50]].forEach(
        ([c, x, y, w, h]) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
      );
      resolve(canvas.toDataURL('image/png'));
    }, 80);
  });
}
