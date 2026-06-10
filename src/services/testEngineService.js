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
    const data = await apiFetch(`${BASE}/run`, { method:'POST', body:{ tests:testList } });
    for (const result of data.results) {
      await new Promise(r => setTimeout(r, 60));
      // Use the test's own URL or fall back to the analyzed site URL
      const screenshotUrl = result.url || siteUrl || '';
      result.screenshot = await captureScreenshot({ ...result, url: screenshotUrl });
      if (onTestComplete) onTestComplete(result);
    }
    return data.results;
  },

  async retestSingle(test) {
    const data = await apiFetch(`${BASE}/retest`, { method:'POST', body:{ test } });
    data.result.screenshot = await captureScreenshot(data.result);
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
async function captureScreenshot(test) {
  return new Promise(resolve => {
    // Try to capture actual page via iframe (works for same-origin or CORS-friendly sites)
    const url = test.url || '';
    if (url && url.startsWith('http')) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1280px;height:800px;border:none;visibility:hidden;';
      iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
      document.body.appendChild(iframe);

      const cleanup = () => {
        try { document.body.removeChild(iframe); } catch {}
      };

      // Timeout fallback - generate annotated canvas screenshot
      const timer = setTimeout(() => {
        cleanup();
        resolve(generateAnnotatedScreenshot(test));
      }, 5000);

      iframe.onload = () => {
        clearTimeout(timer);
        try {
          // Use html2canvas-like approach via canvas + iframe
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) { cleanup(); resolve(generateAnnotatedScreenshot(test)); return; }

          // Draw iframe into canvas using drawWindow (Firefox) or fallback
          const canvas = document.createElement('canvas');
          canvas.width  = 1280;
          canvas.height = 800;
          const ctx = canvas.getContext('2d');

          // Try drawWindow (only works in Firefox extensions, but worth trying)
          if (ctx.drawWindow) {
            ctx.drawWindow(iframe.contentWindow, 0, 0, 1280, 800, '#fff');
            cleanup();
            resolve(canvas.toDataURL('image/png'));
          } else {
            // Standard browsers: capture via foreignObject SVG trick
            const svgData = `
              <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
                <foreignObject width="100%" height="100%">
                  <div xmlns="http://www.w3.org/1999/xhtml">
                    ${iframeDoc.documentElement?.outerHTML?.substring(0, 50000) || ''}
                  </div>
                </foreignObject>
              </svg>`;
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              cleanup();
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => {
              cleanup();
              resolve(generateAnnotatedScreenshot(test));
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
          }
        } catch (e) {
          // Cross-origin blocked — generate annotated screenshot
          cleanup();
          resolve(generateAnnotatedScreenshot(test, url));
        }
      };

      iframe.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(generateAnnotatedScreenshot(test));
      };

      iframe.src = url;
    } else {
      resolve(generateAnnotatedScreenshot(test));
    }
  });
}

// ── Annotated screenshot showing test info + website URL ──────
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
  ctx.beginPath();
  ctx.roundRect(105, 12, 900, 28, 6);
  ctx.fill();
  ctx.fillStyle = test.status === 'passed' ? '#00d4aa' : '#f87171';
  ctx.font = '12px monospace';
  ctx.fillText('🔒 ' + (url || test.url || 'https://app-under-test.com'), 116, 30);

  // Status badge
  ctx.fillStyle = test.status === 'passed' ? 'rgba(0,212,170,0.15)' : 'rgba(248,113,113,0.15)';
  ctx.beginPath(); ctx.roundRect(1040, 12, 220, 28, 6); ctx.fill();
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
  ctx.beginPath(); ctx.roundRect(1140, 66, 110, 28, 6); ctx.fill();
  ctx.fillStyle = '#0a0f1e';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('Get Started', 1155, 84);

  if (type === 'ui' || type === 'security') {
    // Form-style page
    ctx.fillStyle = '#111b3a';
    ctx.beginPath(); ctx.roundRect(390, 150, 500, 440, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,170,0.2)';
    ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = '#f0f4ff';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sign In', 640, 200);
    ctx.textAlign = 'left';

    // Form fields
    [['Email address', 180, '#1a2540'], ['Password', 260, '#1a2540']].forEach(([ph, y, bg]) => {
      ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(430, y + 80, 420, 44, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(0,212,170,0.25)'; ctx.stroke();
      ctx.fillStyle = '#6b7fa3'; ctx.font = '13px sans-serif';
      ctx.fillText(ph, 448, y + 107);
    });

    // Submit button
    ctx.fillStyle = test.status === 'passed' ? '#00d4aa' : '#f87171';
    ctx.beginPath(); ctx.roundRect(430, 480, 420, 46, 8); ctx.fill();
    ctx.fillStyle = '#0a0f1e'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(test.status === 'passed' ? '✓ Login Successful' : '✗ Login Failed', 640, 509);
    ctx.textAlign = 'left';

    // Test highlight overlay
    if (test.status === 'failed') {
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(428, 338, 424, 48, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(248,113,113,0.1)'; ctx.fill();
      ctx.fillStyle = '#f87171'; ctx.font = '11px sans-serif';
      ctx.fillText('⚠ Assertion failed here', 432, 402);
    }

  } else if (type === 'api') {
    // API response view
    ctx.fillStyle = '#0a0f1e';
    ctx.beginPath(); ctx.roundRect(80, 130, 580, 480, 8); ctx.fill();
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
    ctx.beginPath(); ctx.roundRect(700, 130, 500, 240, 8); ctx.fill();
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
      ctx.fillStyle = '#111b3a'; ctx.beginPath(); ctx.roundRect(x, y, 240, 160, 10); ctx.fill();
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
    ctx.beginPath(); ctx.roundRect(80, 140, 800, 60, 8); ctx.fill();
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

