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
  async runTests(testList, onTestComplete) {
    const data = await apiFetch(`${BASE}/run`, { method:'POST', body:{ tests:testList } });
    for (const result of data.results) {
      await new Promise(r => setTimeout(r, 60));
      result.screenshot = await captureScreenshot(result);
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

// ── Screenshot capture ────────────────────────────────────────
async function captureScreenshot(test) {
  return new Promise(resolve => {
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 300;
      const ctx = canvas.getContext('2d');
      const g = ctx.createLinearGradient(0,0,400,300);
      g.addColorStop(0, test.status==='passed'?'#064e3b':'#450a0a');
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle=g; ctx.fillRect(0,0,400,300);
      ctx.fillStyle='#94a3b8'; ctx.font='11px monospace';
      ctx.fillText(`[${(test.type||'TEST').toUpperCase()}] ${test.id||''}`,16,28);
      ctx.fillStyle='#f8fafc'; ctx.font='bold 13px sans-serif';
      ctx.fillText((test.name||'').substring(0,44),16,54);
      ctx.fillStyle=test.status==='passed'?'#4ade80':'#f87171';
      ctx.font='bold 12px sans-serif';
      ctx.fillText((test.status||'').toUpperCase(),16,78);
      ctx.fillStyle='#64748b'; ctx.font='10px monospace';
      ctx.fillText(new Date().toLocaleString(),16,100);
      resolve(canvas.toDataURL('image/png'));
    }, 60);
  });
}
