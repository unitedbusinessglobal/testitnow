// ============================================================
// api/v1/reporting/[action].js — Reporting API (Vercel)
// Handles: /export-data  /execution-history  /summary
//
// Maps to → reportingService.js on the frontend
// Database → Neon: test_executions, test_cases, bug_reports
// ============================================================

import { query } from '../../../lib/db.js';
import { requireAuth, setCors } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { action } = req.query;

  try {
    switch (action) {
      case 'export-data':        return await exportData(req, res, decoded);
      case 'execution-history':  return await executionHistory(req, res, decoded);
      case 'summary':            return await summary(req, res, decoded);
      default:
        return res.status(404).json({ error: `Unknown reporting action: ${action}` });
    }
  } catch (err) {
    console.error(`[reporting/${action}]`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/v1/reporting/export-data?projectId=xxx ──────────
// Returns raw JSON that the frontend uses to build CSV files
async function exportData(req, res, decoded) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId } = req.query;

  // Test cases
  const tcQuery = projectId
    ? `SELECT tc.test_case_key, tc.summary, tc.description, tc.test_case_type,
              tc.priority, tc.status, tc.expected_result, tc.created_at,
              u.full_name AS created_by_name
       FROM test_cases tc
       LEFT JOIN users u ON u.user_id = tc.created_by
       WHERE tc.project_id = $1
       ORDER BY tc.created_at DESC`
    : `SELECT tc.test_case_key, tc.summary, tc.description, tc.test_case_type,
              tc.priority, tc.status, tc.expected_result, tc.created_at,
              u.full_name AS created_by_name
       FROM test_cases tc
       LEFT JOIN users u ON u.user_id = tc.created_by
       WHERE tc.created_by = $1
       ORDER BY tc.created_at DESC`;

  const { rows: testCases } = await query(tcQuery, [projectId || decoded.userId]);

  // Execution results
  const execQuery = projectId
    ? `SELECT te.execution_id, te.execution_status, te.duration_ms, te.error_message,
              te.environment, te.browser, te.created_at,
              tc.test_case_key, tc.summary AS test_name
       FROM test_executions te
       JOIN test_cases tc ON tc.test_case_id = te.test_case_id
       WHERE tc.project_id = $1
       ORDER BY te.created_at DESC LIMIT 500`
    : `SELECT te.execution_id, te.execution_status, te.duration_ms, te.error_message,
              te.environment, te.browser, te.created_at,
              tc.test_case_key, tc.summary AS test_name
       FROM test_executions te
       JOIN test_cases tc ON tc.test_case_id = te.test_case_id
       WHERE te.executed_by = $1
       ORDER BY te.created_at DESC LIMIT 500`;

  const { rows: executions } = await query(execQuery, [projectId || decoded.userId]);

  // Bug reports
  const bugQuery = projectId
    ? `SELECT bug_key, summary, severity, priority, status, created_at
       FROM bug_reports WHERE project_id = $1 ORDER BY created_at DESC`
    : `SELECT bug_key, summary, severity, priority, status, created_at
       FROM bug_reports WHERE reported_by = $1 ORDER BY created_at DESC`;

  const { rows: bugs } = await query(bugQuery, [projectId || decoded.userId]);

  return res.status(200).json({
    testCases: testCases.map(tc => ({
      id:          tc.test_case_key,
      name:        tc.summary,
      description: tc.description,
      type:        tc.test_case_type,
      priority:    tc.priority,
      status:      tc.status,
      expected:    tc.expected_result,
      createdBy:   tc.created_by_name,
      createdAt:   tc.created_at,
    })),
    executions: executions.map(e => ({
      id:        e.execution_id,
      testKey:   e.test_case_key,
      name:      e.test_name,
      status:    e.execution_status,
      duration:  e.duration_ms,
      error:     e.error_message,
      env:       e.environment,
      browser:   e.browser,
      timestamp: e.created_at,
    })),
    bugs: bugs.map(b => ({
      key:      b.bug_key,
      summary:  b.summary,
      severity: b.severity,
      priority: b.priority,
      status:   b.status,
      date:     b.created_at,
    })),
  });
}

// ── GET /api/v1/reporting/execution-history?limit=50 ─────────
async function executionHistory(req, res, decoded) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, limit = 50, offset = 0 } = req.query;

  const { rows } = await query(
    `SELECT te.execution_id, te.execution_status, te.duration_ms, te.error_message,
            te.environment, te.browser, te.os, te.created_at,
            tc.test_case_key, tc.summary AS test_name, tc.test_case_type,
            tc.priority
     FROM test_executions te
     JOIN test_cases tc ON tc.test_case_id = te.test_case_id
     WHERE te.executed_by = $1
       ${projectId ? 'AND tc.project_id = $4' : ''}
     ORDER BY te.created_at DESC
     LIMIT $2 OFFSET $3`,
    projectId
      ? [decoded.userId, Number(limit), Number(offset), projectId]
      : [decoded.userId, Number(limit), Number(offset)],
  );

  return res.status(200).json({
    history: rows,
    total: rows.length,
  });
}

// ── GET /api/v1/reporting/summary?projectId=xxx ───────────────
async function summary(req, res, decoded) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId } = req.query;
  const filterParam = projectId || decoded.userId;
  const filterCol   = projectId ? 'tc.project_id' : 'te.executed_by';

  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE te.execution_status = 'passed') AS passed,
       COUNT(*) FILTER (WHERE te.execution_status = 'failed') AS failed,
       COUNT(*) AS total,
       AVG(te.duration_ms)::INTEGER AS avg_duration_ms,
       COUNT(DISTINCT tc.test_case_id) AS unique_tests
     FROM test_executions te
     JOIN test_cases tc ON tc.test_case_id = te.test_case_id
     WHERE ${filterCol} = $1`,
    [filterParam],
  );

  const bugRes = await query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'Open') AS open_bugs,
            COUNT(*) FILTER (WHERE status = 'Closed') AS closed_bugs
     FROM bug_reports
     WHERE ${projectId ? 'project_id' : 'reported_by'} = $1`,
    [filterParam],
  );

  const s = rows[0];
  const b = bugRes.rows[0];

  return res.status(200).json({
    executions: {
      total:         Number(s.total),
      passed:        Number(s.passed),
      failed:        Number(s.failed),
      passRate:      s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0,
      avgDurationMs: s.avg_duration_ms,
      uniqueTests:   Number(s.unique_tests),
    },
    bugs: {
      total:      Number(b.total),
      open:       Number(b.open_bugs),
      closed:     Number(b.closed_bugs),
    },
  });
}
