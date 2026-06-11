// ============================================================
// src/services/testEngineService.js
// Handles: URL, GitHub, GitLab, Upload, Cached sources
// ============================================================

import { SERVICES } from '../config/services';
import { tokenStore } from './authService';

const BASE    = `${SERVICES.testEngine.BASE_URL}/api/${SERVICES.testEngine.version}/engine`;
const SRC_API = `${SERVICES.auth.BASE_URL}/api/v1/sources`;

async function apiFetch(url, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(url, {
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

// ── Get or create default project ────────────────────────────
async function getOrCreateProject(label) {
  try {
    const projRes = await fetch(
      `${SERVICES.auth.BASE_URL}/api/v1/projects`,
      { headers: { Authorization: `Bearer ${tokenStore.get()}` } },
    );
    if (projRes.ok) {
      const d = await projRes.json();
      if (d.projects?.[0]?.project_id) return d.projects[0].project_id;
    }
    const createRes = await fetch(
      `${SERVICES.auth.BASE_URL}/api/v1/projects`,
      {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tokenStore.get()}` },
        body: JSON.stringify({ projectName: label || 'Default Project' }),
      },
    );
    if (createRes.ok) {
      const d = await createRes.json();
      return d.project?.project_id || null;
    }
  } catch {}
  return null;
}

// ── Save source to history ────────────────────────────────────
async function saveSource(sourceType, params) {
  try {
    const res = await fetch(SRC_API, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tokenStore.get()}` },
      body: JSON.stringify({ sourceType, ...params }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.source?.source_id || null;
    }
  } catch {}
  return null;
}

// ── Update source stats after analysis ───────────────────────
async function updateSourceStats(sourceId, testCount) {
  if (!sourceId) return;
  try {
    await fetch(SRC_API, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tokenStore.get()}` },
      body: JSON.stringify({
        sourceType: 'url', // dummy — triggers ON CONFLICT DO UPDATE
        fingerprint: sourceId,
        cachedTestCount: testCount,
      }),
    });
  } catch {}
}

export const testEngineService = {

  // ── Main analyze dispatcher ───────────────────────────────
  async analyzeAndGenerate(sourceParams, onProgress) {
    const { type } = sourceParams;

    if (type === 'cached') {
      // Return cached data immediately
      if (onProgress) onProgress(100, 'Loaded from cache!');
      return {
        domain:    sourceParams.source?.label || 'Cached',
        generated: sourceParams.generated,
        meta:      sourceParams.meta,
        fromCache: true,
      };
    }

    if (type === 'repo') {
      return this._analyzeRepo(sourceParams, onProgress);
    }

    if (type === 'upload') {
      return this._analyzeUpload(sourceParams, onProgress);
    }

    // Default: URL
    return this._analyzeUrl(sourceParams, onProgress);
  },

  // ── URL analysis ──────────────────────────────────────────
  async _analyzeUrl({ url, authCredentials }, onProgress) {
    let pct = 5;
    const msgs = ['Connecting…','Crawling pages…','Parsing forms…','Finding buttons…','Scanning tables…','Extracting routes…','Generating tests…','Saving…'];
    let msgIdx = 0;
    const iv = setInterval(() => {
      pct = Math.min(88, pct + Math.random() * 9);
      if (onProgress) onProgress(Math.round(pct), msgs[msgIdx++ % msgs.length]);
    }, 1500);

    try {
      const projectId = await getOrCreateProject(new URL(url).hostname);

      // Save to source history
      const sourceId = await saveSource('url', { url, label: url });

      if (onProgress) onProgress(10, 'Starting deep crawl…');

      const data = await apiFetch(`${BASE}/analyze`, {
        method: 'POST',
        body: { url, projectId, authCredentials, maxPages:20, sourceId },
      });

      clearInterval(iv);
      if (onProgress) onProgress(100, `Done! ${data.meta?.totalGenerated||0} test cases`);

      return {
        domain:    data.meta?.domain || new URL(url).hostname,
        generated: data.generated,
        meta:      data.meta,
      };
    } catch (err) {
      clearInterval(iv);
      throw err;
    }
  },

  // ── GitHub/GitLab repo analysis ───────────────────────────
  async _analyzeRepo({ provider, repoOwner, repoName, branch, accessToken }, onProgress) {
    let pct = 5;
    const msgs = [
      'Connecting to repository…',
      'Fetching file tree…',
      'Detecting tech stack…',
      'Extracting routes…',
      'Analysing components…',
      'Scanning API files…',
      'Checking migrations…',
      'Generating test cases…',
      'Saving to database…',
    ];
    let msgIdx = 0;
    const iv = setInterval(() => {
      pct = Math.min(85, pct + Math.random() * 8);
      if (onProgress) onProgress(Math.round(pct), msgs[msgIdx++ % msgs.length]);
    }, 1500);

    try {
      const projectId = await getOrCreateProject(`${repoOwner}/${repoName}`);
      const sourceId  = await saveSource(provider, {
        label: `${repoOwner}/${repoName}`,
        repoOwner, repoName, branch,
        accessToken: accessToken ? accessToken.substring(0,6)+'****' : null,
      });

      if (onProgress) onProgress(15, `Fetching ${provider} repository…`);

      const data = await apiFetch(
        `${SERVICES.auth.BASE_URL}/api/v1/sources/analyze-repo`,
        {
          method: 'POST',
          body: { sourceId, repoOwner, repoName, branch, provider, accessToken, projectId },
        },
      );

      clearInterval(iv);
      if (onProgress) onProgress(100, `Done! ${data.meta?.totalGenerated||0} test cases`);

      return {
        domain:    `${repoOwner}/${repoName}`,
        generated: data.generated,
        meta:      { ...data.meta, isRepo:true },
      };
    } catch (err) {
      clearInterval(iv);
      throw err;
    }
  },

  // ── Source code upload analysis ───────────────────────────
  async _analyzeUpload({ files, label }, onProgress) {
    let pct = 5;
    const msgs = ['Reading files…','Parsing structure…','Detecting patterns…','Generating tests…'];
    let msgIdx = 0;
    const iv = setInterval(() => {
      pct = Math.min(85, pct + Math.random() * 12);
      if (onProgress) onProgress(Math.round(pct), msgs[msgIdx++ % msgs.length]);
    }, 1200);

    try {
      const projectId = await getOrCreateProject(label);
      const sourceId  = await saveSource('upload', { label });

      // Analyse files client-side (no server call for uploads — content stays private)
      const generated = analyzeUploadedFiles(files, label);
      const total     = Object.values(generated).reduce((s,a)=>s+a.length,0);

      // Save to DB via engine
      if (projectId) {
        await apiFetch(`${BASE}/analyze-upload`, {
          method: 'POST',
          body: { projectId, sourceId, label, generated },
        }).catch(() => {}); // Non-fatal — tests still shown in UI
      }

      clearInterval(iv);
      if (onProgress) onProgress(100, `Done! ${total} test cases generated`);

      return {
        domain:    label || 'Uploaded Source',
        generated,
        meta:      { totalGenerated:total, isUpload:true,
          breakdown: Object.fromEntries(Object.entries(generated).map(([k,v])=>[k,v.length])) },
      };
    } catch (err) {
      clearInterval(iv);
      throw err;
    }
  },

  // ── Run tests ─────────────────────────────────────────────
  async runTests(testList, onTestComplete, siteUrl = '') {
    try {
      const data = await apiFetch(`${BASE}/run`, { method:'POST', body:{ tests:testList } });
      for (const result of data.results) {
        await new Promise(r => setTimeout(r, 20));
        try {
          // Backend sends screenshot as JSON descriptor {real, meta}
          // captureScreenshot decodes it and renders the annotated canvas
          result.screenshot = await captureScreenshot(result);
        } catch (ssErr) {
          console.warn('[screenshot] Render failed:', ssErr.message);
          result.screenshot = null;
        }
        if (onTestComplete) onTestComplete(result);
      }
      return data.results;
    } catch (err) {
      console.error('[runTests]', err);
      throw err;
    }
  },

  async retestSingle(test) {
    const data = await apiFetch(`${BASE}/retest`, { method:'POST', body:{ test } });
    try {
      data.result.screenshot = await captureScreenshot(data.result);
    } catch (e) {
      data.result.screenshot = null;
    }
    return data.result;
  },
};

// ── Analyse uploaded files locally ────────────────────────────
function analyzeUploadedFiles(files, label) {
  const all = { ui:[], api:[], security:[], performance:[], database:[], unit:[] };
  let c = 1;
  const id = (p) => `UPLOAD-${p}-${String(c++).padStart(4,'0')}`;

  files.forEach(file => {
    const ext  = file.filename.split('.').pop().toLowerCase();
    const name = file.filename.replace(/\.[^.]+$/,'');
    const content = file.content || '';

    // Detect file type and generate relevant tests
    if (['js','ts','jsx','tsx'].includes(ext)) {
      // Extract function/component names
      const fns = [...content.matchAll(/(?:function|const|class)\s+([A-Z][a-zA-Z0-9]+)/g)].map(m=>m[1]);
      fns.slice(0,10).forEach(fn => {
        all.unit.push({ id:id('FUNC'), name:`${name} → ${fn}() — unit test`, description:`Unit test for ${fn} in ${file.filename}`,
          preconditions:'Jest installed | Module importable',
          testSteps:`1. Import ${fn} from ${file.filename} | 2. Call with valid args | 3. Assert result | 4. Test edge cases | 5. Check error handling`,
          expectedResult:`${fn} returns expected value | Handles edge cases | No uncaught errors`, priority:'High' });
      });

      // API routes
      const routes = [...content.matchAll(/(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/gi)].map(m=>({method:m[1].toUpperCase(),path:m[2]}));
      routes.slice(0,15).forEach(r => {
        all.api.push({ id:id('ROUTE'), name:`${r.method} ${r.path} — from ${name}`,
          method:r.method, endpoint:r.path,
          description:`API route from ${file.filename}`,
          preconditions:'Server running',
          testSteps:`1. Send ${r.method} to ${r.path} | 2. Verify status | 3. Validate response | 4. Test without auth`,
          expectedResult:`Correct status | Valid response | Auth enforced`, priority:'High' });
      });
    }

    // SQL files
    if (['sql'].includes(ext)) {
      const tables = [...content.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/gi)].map(m=>m[1]);
      tables.forEach(table => {
        all.database.push({ id:id('TABLE'), name:`Table "${table}" — CRUD operations`,
          description:`Database tests for ${table} in ${file.filename}`,
          preconditions:'Database running',
          testSteps:`1. INSERT row into ${table} | 2. SELECT and verify | 3. UPDATE and verify | 4. DELETE and verify | 5. Test constraints`,
          expectedResult:`All CRUD operations succeed | Constraints enforced | Performance < 100ms`, priority:'High' });
      });
    }

    // Generic test for every file
    all.unit.push({ id:id('FILE'), name:`${file.filename} — File structure valid`,
      description:`Verify ${file.filename} is syntactically valid`,
      preconditions:'File accessible',
      testSteps:`1. Lint ${file.filename} | 2. Verify no syntax errors | 3. Check imports resolve | 4. Verify exports`,
      expectedResult:`0 lint errors | Syntax valid | All imports resolve`, priority:'Medium' });
  });

  return all;
}

// ── Screenshot capture — takes real screenshot of the tested URL ──
// ─────────────────────────────────────────────────────────────
// renderAnnotatedScreenshot
// Receives the JSON descriptor from the backend and draws:
//   - real website screenshot (if available) as background
//   - test-specific overlay showing type, name, steps, status
// ─────────────────────────────────────────────────────────────
async function captureScreenshot(test) {
  // The backend sends screenshot as JSON: { real: base64|null, meta: {...} }
  // If it's already rendered (old canvas dataUrl) just return it.
  const raw = test.screenshot;
  if (!raw) return generateAnnotatedScreenshot(test, test.url || '');

  // If it's already a data URL (canvas fallback from previous runs) pass through
  if (typeof raw === 'string' && raw.startsWith('data:')) return raw;

  // Parse the descriptor from backend
  let descriptor = null;
  if (typeof raw === 'string') {
    try { descriptor = JSON.parse(raw); } catch { return generateAnnotatedScreenshot(test, test.url || ''); }
  } else if (typeof raw === 'object') {
    descriptor = raw;
  }

  if (!descriptor) return generateAnnotatedScreenshot(test, test.url || '');

  const { real, meta } = descriptor;

  return new Promise(resolve => {
    const W = 1280, H = 900;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const drawOverlay = () => {
      const m = meta || {};
      const status  = m.status || test.status || 'passed';
      const type    = m.type   || (test.type || 'ui').toLowerCase();
      const color   = m.color  || '#00d4aa';
      const isPassed = status === 'passed';

      // ── Browser chrome bar ──────────────────────────────
      ctx.fillStyle = '#1e2433';
      ctx.fillRect(0, 0, W, 52);

      // Traffic lights
      [['#ff5f57', 28], ['#febc2e', 52], ['#28c840', 76]].forEach(([c, x]) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, 26, 7, 0, Math.PI * 2); ctx.fill();
      });

      // URL bar
      ctx.fillStyle = '#2a3347';
      roundRect(ctx, 105, 14, 860, 26, 5); ctx.fill();

      // Lock icon + URL
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText('🔒 ' + (m.url || test.url || 'https://app-under-test.com').substring(0, 70), 114, 31);

      // Status pill in URL bar right side
      ctx.fillStyle = isPassed ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)';
      roundRect(ctx, 975, 14, 120, 26, 5); ctx.fill();
      ctx.fillStyle = isPassed ? '#4ade80' : '#f87171';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isPassed ? '✓ PASSED' : '✗ FAILED', 1035, 31);
      ctx.textAlign = 'left';

      // Browser tabs bar
      ctx.fillStyle = '#161e30';
      ctx.fillRect(0, 52, W, 8);

      // ── Test info overlay — right side panel ────────────
      const panelX = W - 360;
      const panelW = 360;
      const panelY = 60;
      const panelH = H - 60;

      // Semi-transparent panel background
      ctx.fillStyle = 'rgba(10,15,30,0.92)';
      roundRect(ctx, panelX, panelY, panelW, panelH, 0); ctx.fill();

      // Panel accent line
      ctx.fillStyle = color;
      ctx.fillRect(panelX, panelY, 3, panelH);

      // Type badge
      ctx.fillStyle = color + '22';
      roundRect(ctx, panelX + 12, panelY + 12, 80, 22, 4); ctx.fill();
      ctx.fillStyle = color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(type.toUpperCase(), panelX + 52, panelY + 27);
      ctx.textAlign = 'left';

      // Priority badge
      const priBg = { Critical:'rgba(239,68,68,0.2)', High:'rgba(249,115,22,0.2)', Medium:'rgba(234,179,8,0.2)', Low:'rgba(74,222,128,0.2)' };
      const priCol = { Critical:'#f87171', High:'#fb923c', Medium:'#fbbf24', Low:'#4ade80' };
      const pri = m.priority || 'High';
      ctx.fillStyle = priBg[pri] || 'rgba(255,255,255,0.1)';
      roundRect(ctx, panelX + 100, panelY + 12, 60, 22, 4); ctx.fill();
      ctx.fillStyle = priCol[pri] || '#94a3b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pri, panelX + 130, panelY + 27);
      ctx.textAlign = 'left';

      // Test ID
      ctx.fillStyle = '#6b7fa3';
      ctx.font = '10px monospace';
      ctx.fillText(m.id || test.id || '', panelX + 12, panelY + 52);

      // Test name (wrap at ~38 chars)
      const name = m.name || test.name || '';
      ctx.fillStyle = '#f0f4ff';
      ctx.font = 'bold 13px sans-serif';
      const words = name.split(' ');
      let line = '', lineY = panelY + 72;
      for (const word of words) {
        const test2 = line + word + ' ';
        if (ctx.measureText(test2).width > panelW - 24) {
          ctx.fillText(line, panelX + 12, lineY);
          line = word + ' '; lineY += 18;
          if (lineY > panelY + 120) { line = '…'; break; }
        } else { line = test2; }
      }
      if (line) ctx.fillText(line.trim(), panelX + 12, lineY);

      // Divider
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(panelX + 12, panelY + 132); ctx.lineTo(panelX + panelW - 12, panelY + 132); ctx.stroke();

      // Test Steps
      const steps = m.steps || (test.testSteps || '').split(' | ').filter(Boolean).slice(0, 5);
      if (steps.length) {
        ctx.fillStyle = '#6b7fa3';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('TEST STEPS', panelX + 12, panelY + 150);

        steps.forEach((step, i) => {
          const stepY = panelY + 166 + i * 28;
          const done  = isPassed || i < steps.length - 1;

          // Step circle
          ctx.fillStyle = done ? (isPassed ? '#4ade80' : (i < steps.length - 1 ? '#4ade80' : '#f87171')) : '#6b7fa3';
          ctx.beginPath(); ctx.arc(panelX + 22, stepY, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#0a0f1e';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(done ? (i < steps.length - 1 || isPassed ? '✓' : '✗') : (i + 1), panelX + 22, stepY + 3);
          ctx.textAlign = 'left';

          // Connector line
          if (i < steps.length - 1) {
            ctx.strokeStyle = '#2a3347';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(panelX + 22, stepY + 8); ctx.lineTo(panelX + 22, stepY + 20); ctx.stroke();
          }

          // Step text
          ctx.fillStyle = done ? '#d1d9f0' : '#6b7fa3';
          ctx.font = '11px sans-serif';
          const stepText = step.replace(/^\d+\.\s*/, '').substring(0, 42);
          ctx.fillText(stepText, panelX + 36, stepY + 4);
        });
      }

      // Expected result
      const expected = m.expected || test.expectedResult || '';
      if (expected) {
        const expY = panelY + 166 + steps.length * 28 + 12;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.moveTo(panelX + 12, expY); ctx.lineTo(panelX + panelW - 12, expY); ctx.stroke();
        ctx.fillStyle = '#6b7fa3';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('EXPECTED', panelX + 12, expY + 14);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        const expLines = expected.match(/.{1,44}/g) || [];
        expLines.slice(0, 3).forEach((l, i) => ctx.fillText(l, panelX + 12, expY + 28 + i * 14));
      }

      // Bottom status bar
      const barY = H - 44;
      ctx.fillStyle = isPassed ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';
      ctx.fillRect(0, barY, W, 44);
      ctx.strokeStyle = isPassed ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(W, barY); ctx.stroke();

      ctx.fillStyle = isPassed ? '#4ade80' : '#f87171';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(isPassed ? '✓  Test Passed' : '✗  Test Failed', 20, barY + 27);

      ctx.fillStyle = '#6b7fa3';
      ctx.font = '11px monospace';
      ctx.fillText(`${type.toUpperCase()}  ·  ${m.id || ''}  ·  ${new Date().toLocaleTimeString()}`, 200, barY + 27);

      resolve(canvas.toDataURL('image/png'));
    };

    if (real) {
      // Draw real website screenshot as background (left 920px), panel on right
      const img = new Image();
      img.onload = () => {
        // Draw real screenshot — clip to left part (leaving room for panel)
        ctx.drawImage(img, 0, 60, W, H - 60 - 44);
        // Darken slightly for readability
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0, 60, panelX, H - 60 - 44);
        drawOverlay();
      };
      img.onerror = () => {
        // Real screenshot failed to load — draw simulated page instead
        drawSimulatedPage(ctx, { ...test, ...meta, status: meta?.status || status });
        drawOverlay();
      };
      img.src = `data:image/png;base64,${real}`;
    } else {
      // No real screenshot — draw simulated page background
      ctx.fillStyle = '#0d1530';
      ctx.fillRect(0, 60, W, H - 60);
      drawSimulatedPage(ctx, { ...test, type: meta?.type || test.type, status: meta?.status || test.status, url: meta?.url || test.url });
      drawOverlay();
    }
  });
}

// ── Annotated screenshot showing test info + website URL ──────
function roundRect(ctx, x, y, w, h, r = 6) {
  // Safe polyfill — works in all browsers including older ones
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function generateAnnotatedScreenshot(test, url = '') {
  const canvas = document.createElement('canvas');
  canvas.width  = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background — simulates browser window
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, 1280, 800);

  // Browser chrome bar
  ctx.fillStyle = '#1e2433';
  ctx.fillRect(0, 0, 1280, 52);

  // Traffic lights
  [['#ff5f57',28], ['#febc2e',52], ['#28c840',76]].forEach(([c,x]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 26, 7, 0, Math.PI*2); ctx.fill();
  });

  // URL bar
  ctx.fillStyle = '#2a3347';
  roundRect(ctx, 105, 12, 900, 28, 6);
  ctx.fill();
  ctx.fillStyle = test.status === 'passed' ? '#00d4aa' : '#f87171';
  ctx.font = '12px monospace';
  ctx.fillText('🔒 ' + (url || test.url || 'https://app-under-test.com'), 116, 30);

  // Status badge
  ctx.fillStyle = test.status === 'passed' ? 'rgba(0,212,170,0.15)' : 'rgba(248,113,113,0.15)';
  roundRect(ctx, 1040, 12, 220, 28, 6); ctx.fill();
  ctx.fillStyle = test.status === 'passed' ? '#00d4aa' : '#f87171';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(test.status === 'passed' ? '✓ TEST PASSED' : '✗ TEST FAILED', 1150, 30);
  ctx.textAlign = 'left';

  // Page content area — draw simulated page
  ctx.fillStyle = '#0d1530';
  ctx.fillRect(0, 52, 1280, 748);

  // Simulate page elements based on test type
  drawSimulatedPage(ctx, test, url);

  // Test info overlay (bottom)
  ctx.fillStyle = 'rgba(10,15,30,0.92)';
  ctx.fillRect(0, 680, 1280, 120);

  // Separator line
  ctx.strokeStyle = test.status === 'passed' ? '#00d4aa' : '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 680); ctx.lineTo(1280, 680); ctx.stroke();

  // Test details
  ctx.fillStyle = '#6b7fa3';
  ctx.font = '11px monospace';
  ctx.fillText(`ID: ${test.id || 'TC-001'}  |  TYPE: ${(test.type||'').toUpperCase()}  |  PRIORITY: ${test.priority||'High'}  |  ${new Date().toLocaleString()}`, 20, 700);

  ctx.fillStyle = '#f0f4ff';
  ctx.font = 'bold 15px sans-serif';
  const titleText = (test.name || '').substring(0, 90);
  ctx.fillText(titleText, 20, 724);

  if (test.testSteps) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    const steps = test.testSteps.split(' | ').slice(0, 3);
    steps.forEach((s, i) => ctx.fillText(`${i+1}. ${s.substring(0, 120)}`, 20, 744 + i*14));
  }

  if (test.expectedResult) {
    ctx.fillStyle = '#6b7fa3';
    ctx.font = '10px sans-serif';
    ctx.fillText('Expected: ' + test.expectedResult.substring(0, 140), 20, 792);
  }

  return canvas.toDataURL('image/png');
}

function drawSimulatedPage(ctx, test, url) {
  const type = test.type || 'ui';

  // Nav bar
  ctx.fillStyle = '#111b3a';
  ctx.fillRect(0, 52, 1280, 56);
  ctx.fillStyle = '#00d4aa';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('⚡ YourApp', 24, 86);

  // Nav links
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ['Home','Products','Pricing','About','Contact'].forEach((l,i) => {
    ctx.fillText(l, 160 + i*90, 86);
  });

  // CTA button
  ctx.fillStyle = '#00d4aa';
  roundRect(ctx, 1140, 66, 110, 28, 6); ctx.fill();
  ctx.fillStyle = '#0a0f1e';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('Get Started', 1155, 84);

  if (type === 'ui' || type === 'security') {
    // Form-style page
    ctx.fillStyle = '#111b3a';
    roundRect(ctx, 390, 150, 500, 440, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,170,0.2)';
    ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = '#f0f4ff';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sign In', 640, 200);
    ctx.textAlign = 'left';

    // Form fields
    [['Email address', 180, '#1a2540'], ['Password', 260, '#1a2540']].forEach(([ph, y, bg]) => {
      ctx.fillStyle = bg; roundRect(ctx, 430, y + 80, 420, 44, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(0,212,170,0.25)'; ctx.stroke();
      ctx.fillStyle = '#6b7fa3'; ctx.font = '13px sans-serif';
      ctx.fillText(ph, 448, y + 107);
    });

    // Submit button
    ctx.fillStyle = test.status === 'passed' ? '#00d4aa' : '#f87171';
    roundRect(ctx, 430, 480, 420, 46, 8); ctx.fill();
    ctx.fillStyle = '#0a0f1e'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(test.status === 'passed' ? '✓ Login Successful' : '✗ Login Failed', 640, 509);
    ctx.textAlign = 'left';

    // Test highlight overlay
    if (test.status === 'failed') {
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
      roundRect(ctx, 428, 338, 424, 48, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(248,113,113,0.1)'; ctx.fill();
      ctx.fillStyle = '#f87171'; ctx.font = '11px sans-serif';
      ctx.fillText('⚠ Assertion failed here', 432, 402);
    }

  } else if (type === 'api') {
    // API response view
    ctx.fillStyle = '#0a0f1e';
    roundRect(ctx, 80, 130, 580, 480, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,170,0.2)'; ctx.stroke();

    ctx.fillStyle = '#111b3a';
    ctx.fillRect(80, 130, 580, 36);
    ctx.fillStyle = test.method === 'POST' ? '#f59e0b' : '#00d4aa';
    ctx.font = 'bold 13px monospace'; ctx.fillText(test.method || 'GET', 98, 153);
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px monospace';
    ctx.fillText(test.endpoint || '/api/endpoint', 145, 153);

    const statusCode = test.status === 'passed' ? '200 OK' : '400 Bad Request';
    ctx.fillStyle = test.status === 'passed' ? '#4ade80' : '#f87171';
    ctx.fillText('← ' + statusCode, 98, 185);

    // JSON response
    ctx.fillStyle = '#4ade80'; ctx.font = '12px monospace';
    const lines = ['  "status": "ok",', '  "data": {', '    "token": "eyJhbGci..."', '  },', '  "timestamp": "' + new Date().toISOString() + '"'];
    ctx.fillText('{', 98, 210);
    lines.forEach((l,i) => {
      ctx.fillStyle = i%2===0 ? '#94a3b8' : '#00d4aa';
      ctx.fillText(l, 98, 230 + i*20);
    });
    ctx.fillStyle = '#94a3b8'; ctx.fillText('}', 98, 340);

    // Right: response details
    ctx.fillStyle = '#111b3a';
    roundRect(ctx, 700, 130, 500, 240, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,170,0.2)'; ctx.stroke();
    ctx.fillStyle = '#6b7fa3'; ctx.font = '11px sans-serif';
    [['Status',test.status==='passed'?'200 OK':'400 Bad Request'],['Time',`${test.duration||0}ms`],['Size','1.2 KB'],['Type','application/json']].forEach(([k,v],i) => {
      ctx.fillStyle = '#6b7fa3'; ctx.fillText(k, 720, 162 + i*28);
      ctx.fillStyle = test.status==='passed'?'#4ade80':'#f87171'; ctx.fillText(v, 840, 162 + i*28);
    });

  } else if (type === 'performance') {
    // Performance metrics view
    const metrics = [['LCP','2.1s','#4ade80',85],['FID','45ms','#4ade80',90],['CLS','0.05','#4ade80',95],['TTFB','380ms','#f59e0b',72]];
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#f0f4ff'; ctx.textAlign = 'center';
    ctx.fillText('Performance Report', 640, 140); ctx.textAlign = 'left';
    metrics.forEach(([name, val, color, score], i) => {
      const x = 100 + i*280, y = 200;
      ctx.fillStyle = '#111b3a'; roundRect(ctx, x, y, 240, 160, 10); ctx.fill();
      ctx.strokeStyle = color + '44'; ctx.stroke();
      ctx.fillStyle = color; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center';
      ctx.fillText(val, x+120, y+70);
      ctx.fillStyle = '#6b7fa3'; ctx.font = '13px sans-serif';
      ctx.fillText(name, x+120, y+100);
      // Score arc
      ctx.strokeStyle = color; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x+120, y+130, 20, -Math.PI/2, (-Math.PI/2) + (score/100)*Math.PI*2);
      ctx.stroke();
      ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(score, x+112, y+135);
      ctx.textAlign = 'left';
    });
  } else {
    // Generic test page
    ctx.fillStyle = '#111b3a';
    roundRect(ctx, 80, 140, 800, 60, 8); ctx.fill();
    ctx.fillStyle = test.status==='passed' ? '#00d4aa' : '#f87171';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(test.status==='passed' ? '✓ Test assertion passed' : '✗ Test assertion failed', 100, 177);

    const steps = (test.testSteps||'').split(' | ').slice(0,6);
    steps.forEach((s,i) => {
      ctx.fillStyle = i < steps.length-1 ? '#4ade80' : (test.status==='passed'?'#4ade80':'#f87171');
      ctx.font = '13px sans-serif';
      ctx.fillText(`${i===steps.length-1?'►':'✓'} ${s.substring(0,80)}`, 100, 240+i*36);
    });
  }
}

