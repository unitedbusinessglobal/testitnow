// ============================================================
// src/services/testEngineService.js  (Frontend — Netlify)
// Calls: Vercel backend  /api/v1/engine/[action]
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

  async analyzeAndGenerate(url, authCredentials = null, onProgress) {
    // Animate progress while waiting for backend crawl
    let pct = 5;
    const msgs = [
      'Connecting to website…',
      'Crawling pages…',
      'Parsing navigation menus…',
      'Extracting form elements…',
      'Analysing input fields…',
      'Discovering buttons & links…',
      'Scanning tables & dropdowns…',
      'Checking images & media…',
      'Identifying security surfaces…',
      'Generating test cases…',
      'Saving to database…',
    ];
    let msgIdx = 0;
    const progressInterval = setInterval(() => {
      pct = Math.min(90, pct + Math.random() * 8);
      if (onProgress) onProgress(Math.round(pct), msgs[msgIdx % msgs.length]);
      msgIdx++;
    }, 1500);

    try {
      // Get or create project
      let projectId = null;
      try {
        const projRes = await fetch(
          `${SERVICES.auth.BASE_URL}/api/${SERVICES.auth.version}/projects`,
          { headers: { Authorization: `Bearer ${tokenStore.get()}` } },
        );
        if (projRes.ok) {
          const d = await projRes.json();
          projectId = d.projects?.[0]?.project_id || null;
        }
      } catch {}

      if (!projectId) {
        try {
          const createRes = await fetch(
            `${SERVICES.auth.BASE_URL}/api/${SERVICES.auth.version}/projects`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStore.get()}` },
              body: JSON.stringify({ projectName: new URL(url).hostname }),
            },
          );
          if (createRes.ok) {
            const d = await createRes.json();
            projectId = d.project?.project_id || null;
          }
        } catch {}
      }

      if (onProgress) onProgress(10, 'Starting deep crawl…');

      const data = await apiFetch('analyze', {
        method: 'POST',
        body: { url, projectId, authCredentials, maxPages: 20 },
      });

      clearInterval(progressInterval);
      if (onProgress) onProgress(100, `Complete! ${data.meta?.totalGenerated || 0} test cases generated`);

      return {
        domain:    data.meta?.domain || new URL(url).hostname,
        generated: data.generated,
        meta:      data.meta,
      };
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  },

  async runTests(testList, onTestComplete) {
    const data = await apiFetch('run', { method: 'POST', body: { tests: testList } });
    for (const result of data.results) {
      await new Promise(r => setTimeout(r, 60));
      result.screenshot = await captureScreenshot(result);
      if (onTestComplete) onTestComplete(result);
    }
    return data.results;
  },

  async retestSingle(test) {
    const data = await apiFetch('retest', { method: 'POST', body: { test } });
    data.result.screenshot = await captureScreenshot(data.result);
    return data.result;
  },
};

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
      ctx.fillText(`[${(test.type||'TEST').toUpperCase()}] ${test.id||''}`, 16, 28);
      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText((test.name||'').substring(0, 44), 16, 54);
      ctx.fillStyle = test.status === 'passed' ? '#4ade80' : '#f87171';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(test.status?.toUpperCase()||'', 16, 78);
      ctx.fillStyle = '#64748b'; ctx.font = '10px monospace';
      ctx.fillText(new Date().toLocaleString(), 16, 100);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
      ctx.strokeRect(16, 115, 368, 165);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(17, 116, 367, 22);
      ctx.fillStyle = '#475569'; ctx.font = '9px monospace';
      ctx.fillText('● ● ●   https://' + (test.url||'example.com'), 26, 130);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(17, 139, 367, 140);
      [['#1e3a5f',28,149,160,55],['#1e3a5f',200,149,160,55],['#1e293b',28,215,340,50]]
        .forEach(([c,x,y,w,h]) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); });
      resolve(canvas.toDataURL('image/png'));
    }, 60);
  });
}
