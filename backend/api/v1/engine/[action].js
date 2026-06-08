// ============================================================
// api/v1/engine/[action].js — Test Engine API Route (Vercel)
// Handles: /analyze   /run   /retest
//
// Maps to → testEngineService.js on the frontend
// Database → Neon: test_cases, test_executions tables
// ============================================================

import { query, withTransaction } from '../../../lib/db.js';
import { requireAuth, setCors } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { action } = req.query;

  try {
    switch (action) {
      case 'analyze': return await analyze(req, res, decoded);
      case 'run':     return await run(req, res, decoded);
      case 'retest':  return await retest(req, res, decoded);
      default:
        return res.status(404).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[engine/${action}]`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v1/engine/analyze ──────────────────────────────
// Generates test cases from a URL and persists them to Neon
async function analyze(req, res, decoded) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, projectId, authCredentials } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  // Validate URL
  let urlObj;
  try { urlObj = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

  // Check plan limits
  const { rows: userRows } = await query(
    `SELECT u.plan_type, u.tests_remaining, sp.max_test_cases
     FROM users u
     JOIN subscription_plans sp ON sp.plan_type = u.plan_type
     WHERE u.user_id = $1`,
    [decoded.userId],
  );
  const userData = userRows[0];
  if (!userData) return res.status(404).json({ error: 'User not found' });

  const maxCases = userData.max_test_cases === -1 ? Infinity : (userData.max_test_cases || 10);

  // Generate test cases (core logic — replace with real crawler in production)
  const generated = generateTestSuite(urlObj, authCredentials, maxCases);

  // Persist to Neon inside a transaction
  const saved = await withTransaction(async (client) => {
    const results = { unit: [], api: [], database: [], performance: [], security: [], ui: [] };

    for (const [type, list] of Object.entries(generated)) {
      for (const tc of list) {
        // Generate unique key: PROJECT-TYPE-timestamp-random
        const keyBase = `${projectId.substring(0, 8).toUpperCase()}-${type.toUpperCase()}`;
        const { rows } = await client.query(
          `INSERT INTO test_cases
             (test_case_key, project_id, test_case_type, summary, description,
              preconditions, test_steps, test_data, expected_result, priority, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Draft', $11)
           ON CONFLICT (test_case_key) DO UPDATE
             SET summary = EXCLUDED.summary, updated_at = NOW()
           RETURNING test_case_id, test_case_key, summary, priority`,
          [
            tc.id || `${keyBase}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            projectId,
            type,
            tc.name || tc.summary,
            tc.description || null,
            tc.preconditions || null,
            tc.testSteps ? JSON.stringify({ steps: tc.testSteps.split(' | ') }) : null,
            tc.testData ? JSON.stringify({ data: tc.testData }) : null,
            tc.expectedResult || null,
            tc.priority || 'Medium',
            decoded.userId,
          ],
        );
        results[type].push({ ...tc, dbId: rows[0].test_case_id, dbKey: rows[0].test_case_key });
      }
    }

    return results;
  });

  const totalSaved = Object.values(saved).reduce((s, a) => s + a.length, 0);

  return res.status(200).json({
    success: true,
    message: `Generated and saved ${totalSaved} test cases`,
    generated: saved,
    meta: {
      url,
      domain: urlObj.hostname,
      totalGenerated: totalSaved,
      planLimit: maxCases,
      limited: totalSaved >= maxCases,
    },
  });
}

// ── POST /api/v1/engine/run ───────────────────────────────────
// Executes a list of tests and saves results to test_executions
async function run(req, res, decoded) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tests, environment = 'production', browser = 'chrome', os = 'linux' } = req.body;
  if (!Array.isArray(tests) || tests.length === 0) {
    return res.status(400).json({ error: 'tests array is required' });
  }

  // Check run credits
  const { rows: userRows } = await query(
    `SELECT tests_remaining, plan_type FROM users WHERE user_id = $1`,
    [decoded.userId],
  );
  const user = userRows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.plan_type === 'free' && user.tests_remaining <= 0) {
    return res.status(403).json({ error: 'No test runs remaining. Please upgrade your plan.' });
  }

  // Deduct one run credit for free plan
  if (user.plan_type === 'free') {
    await query(
      `UPDATE users SET tests_remaining = GREATEST(0, tests_remaining - 1) WHERE user_id = $1`,
      [decoded.userId],
    );
  }

  // Execute each test and persist results
  const results = [];

  for (const test of tests) {
    // Simulate execution (replace with real browser automation / API calls)
    const passed   = Math.random() > 0.15;
    const duration = Math.floor(Math.random() * 2000) + 100;
    const status   = passed ? 'passed' : 'failed';

    // Persist execution record
    if (test.dbId) {
      const { rows } = await query(
        `INSERT INTO test_executions
           (test_case_id, executed_by, execution_status, duration_ms, error_message,
            environment, browser, os)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING execution_id`,
        [
          test.dbId,
          decoded.userId,
          status,
          duration,
          passed ? null : 'Assertion failed: expected response did not match',
          environment,
          browser,
          os,
        ],
      );

      results.push({
        ...test,
        executionId: rows[0].execution_id,
        status,
        duration,
        timestamp: new Date().toISOString(),
        error: passed ? null : 'Assertion failed: expected response did not match',
        isRetest: false,
      });
    } else {
      // Test not yet persisted — run without DB record
      results.push({
        ...test,
        status,
        duration,
        timestamp: new Date().toISOString(),
        error: passed ? null : 'Assertion failed',
        isRetest: false,
      });
    }
  }

  const summary = {
    total:    results.length,
    passed:   results.filter(r => r.status === 'passed').length,
    failed:   results.filter(r => r.status === 'failed').length,
    duration: results.reduce((s, r) => s + r.duration, 0),
  };

  return res.status(200).json({ success: true, results, summary });
}

// ── POST /api/v1/engine/retest ────────────────────────────────
async function retest(req, res, decoded) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { test } = req.body;
  if (!test) return res.status(400).json({ error: 'test object is required' });

  const passed   = Math.random() > 0.3; // Higher pass rate on retest
  const duration = Math.floor(Math.random() * 2000) + 100;
  const status   = passed ? 'passed' : 'failed';

  if (test.dbId) {
    await query(
      `INSERT INTO test_executions
         (test_case_id, executed_by, execution_status, duration_ms, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        test.dbId,
        decoded.userId,
        status,
        duration,
        passed ? null : 'Test still failing on retest',
      ],
    );
  }

  return res.status(200).json({
    success: true,
    result: {
      ...test,
      status,
      duration,
      timestamp: new Date().toISOString(),
      error: passed ? null : 'Test still failing on retest',
      isRetest: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// INTERNAL: Test generation logic
// Replace with real crawler (Playwright / Puppeteer) in prod
// ─────────────────────────────────────────────────────────────
function generateTestSuite(urlObj, authCredentials, maxCases) {
  const origin = urlObj.origin;
  const hasAuth = authCredentials?.username && authCredentials?.password;

  const all = { unit: [], api: [], database: [], performance: [], security: [], ui: [] };

  const pages = [
    { url: urlObj.href, title: 'Homepage', links: 15 },
    { url: `${origin}/about`, title: 'About', links: 10 },
    { url: `${origin}/contact`, title: 'Contact', links: 8 },
    { url: `${origin}/login`, title: 'Login', links: 5 },
    { url: `${origin}/products`, title: 'Products', links: 25 },
  ];

  pages.forEach((page, i) => {
    all.ui.push({
      id: `TC-UI-${String(i + 1).padStart(3, '0')}`,
      name: `Navigate to ${page.title}`,
      url: page.url,
      description: `Verify navigation to ${page.title}`,
      testSteps: `1. Navigate to ${page.url} | 2. Check load | 3. Verify title`,
      expectedResult: `Loads < 3s | Title = "${page.title}"`,
      priority: 'High',
    });
  });

  ['/api/health', '/api/users', '/api/products', '/api/auth/login'].forEach((ep, i) => {
    all.api.push({
      id: `TC-API-${String(i + 1).padStart(3, '0')}`,
      name: `GET ${ep}`,
      method: 'GET',
      endpoint: `${origin}${ep}`,
      expectedStatus: 200,
      priority: 'High',
    });
  });

  if (hasAuth) {
    all.ui.push({ id: 'TC-AUTH-001', name: 'Login valid creds', priority: 'Critical' });
    all.ui.push({ id: 'TC-AUTH-002', name: 'Login invalid creds', priority: 'Critical' });
  }

  ['SQL Injection', 'XSS Attack', 'CSRF Protection'].forEach((name, i) => {
    all.security.push({ id: `TC-SEC-${String(i + 1).padStart(3, '0')}`, name, priority: i < 2 ? 'Critical' : 'High' });
  });

  all.performance.push({ id: 'TC-PERF-001', name: `Load Test — ${urlObj.hostname}`, requests: 100, priority: 'High' });
  all.database.push({ id: 'TC-DB-001', name: 'DB Connection', query: 'SELECT 1', priority: 'High' });
  all.unit.push({ id: 'TC-UNIT-001', name: 'URL Validation', priority: 'Medium' });

  // Enforce plan limits
  const limited = {};
  let total = 0;
  for (const [type, list] of Object.entries(all)) {
    const remaining = maxCases - total;
    if (remaining <= 0) { limited[type] = []; continue; }
    limited[type] = list.slice(0, remaining);
    total += limited[type].length;
  }

  return limited;
}
