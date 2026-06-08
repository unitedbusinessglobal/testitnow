// ============================================================
// api/v1/bugs/[action].js — Bug Reports API (Vercel)
// Handles: /create   /list   /update
//
// Maps to → bugTrackerService.js on the frontend
// Database → Neon: bug_reports table
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
      case 'create': return await create(req, res, decoded);
      case 'list':   return await list(req, res, decoded);
      case 'update': return await update(req, res, decoded);
      default:
        return res.status(404).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[bugs/${action}]`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v1/bugs/create ──────────────────────────────────
async function create(req, res, decoded) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, testCaseId, summary, description, severity, priority, screenshotUrl } = req.body;

  if (!projectId || !summary) {
    return res.status(400).json({ error: 'projectId and summary are required' });
  }

  // Generate unique bug key: BUG-{project_prefix}-{timestamp}
  const bugKey = `BUG-${projectId.substring(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const { rows } = await query(
    `INSERT INTO bug_reports
       (bug_key, project_id, test_case_id, summary, description,
        severity, priority, status, reported_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open', $8)
     RETURNING bug_id, bug_key, summary, severity, priority, status, created_at`,
    [
      bugKey,
      projectId,
      testCaseId || null,
      summary,
      description || null,
      severity || 'Major',
      priority || 'High',
      decoded.userId,
    ],
  );

  const bug = rows[0];

  // TODO: If Jira config is set on the user/project, also create a Jira issue here:
  // const jiraKey = await createJiraIssue(jiraConfig, { summary, description, priority });
  // await query(`UPDATE bug_reports SET jira_key = $1 WHERE bug_id = $2`, [jiraKey, bug.bug_id]);

  return res.status(201).json({
    success: true,
    bug: {
      id: bug.bug_id,
      jiraKey: bug.bug_key,   // using bug_key as the display key
      summary: bug.summary,
      severity: bug.severity,
      priority: bug.priority,
      status: bug.status,
      createdAt: bug.created_at,
    },
  });
}

// ── GET /api/v1/bugs/list?projectId=xxx ───────────────────────
async function list(req, res, decoded) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, status, limit = 50, offset = 0 } = req.query;

  let sql = `
    SELECT br.bug_id, br.bug_key, br.summary, br.description,
           br.severity, br.priority, br.status, br.created_at, br.updated_at,
           u.full_name AS reported_by_name,
           tc.summary AS test_case_summary
    FROM bug_reports br
    LEFT JOIN users u ON u.user_id = br.reported_by
    LEFT JOIN test_cases tc ON tc.test_case_id = br.test_case_id
    WHERE br.reported_by = $1
  `;
  const params = [decoded.userId];

  if (projectId) {
    params.push(projectId);
    sql += ` AND br.project_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND br.status = $${params.length}`;
  }

  sql += ` ORDER BY br.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await query(sql, params);

  return res.status(200).json({
    bugs: rows.map(b => ({
      id: b.bug_id,
      jiraKey: b.bug_key,
      summary: b.summary,
      description: b.description,
      severity: b.severity,
      priority: b.priority,
      status: b.status,
      createdAt: b.created_at,
      reportedBy: b.reported_by_name,
      testCase: b.test_case_summary,
    })),
    total: rows.length,
  });
}

// ── PATCH /api/v1/bugs/update ─────────────────────────────────
async function update(req, res, decoded) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { bugId, status, priority, severity } = req.body;
  if (!bugId) return res.status(400).json({ error: 'bugId is required' });

  const fields = [];
  const params = [];

  if (status)   { params.push(status);   fields.push(`status = $${params.length}`); }
  if (priority) { params.push(priority); fields.push(`priority = $${params.length}`); }
  if (severity) { params.push(severity); fields.push(`severity = $${params.length}`); }

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(bugId);
  const { rows } = await query(
    `UPDATE bug_reports SET ${fields.join(', ')}, updated_at = NOW()
     WHERE bug_id = $${params.length}
     RETURNING bug_id, status, priority, severity, updated_at`,
    params,
  );

  if (!rows.length) return res.status(404).json({ error: 'Bug not found' });

  return res.status(200).json({ success: true, bug: rows[0] });
}
