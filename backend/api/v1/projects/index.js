// ============================================================
// api/v1/projects/index.js — Projects CRUD API (Vercel)
// GET /api/v1/projects          → list user's projects
// POST /api/v1/projects         → create project
// PATCH /api/v1/projects        → update project
// DELETE /api/v1/projects?id=x  → delete project
// ============================================================

import { query } from '../../../lib/db.js';
import { requireAuth, setCors } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  try {
    switch (req.method) {
      case 'GET':    return await listProjects(req, res, decoded);
      case 'POST':   return await createProject(req, res, decoded);
      case 'PATCH':  return await updateProject(req, res, decoded);
      case 'DELETE': return await deleteProject(req, res, decoded);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[projects]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function listProjects(req, res, decoded) {
  const { rows } = await query(
    `SELECT p.project_id, p.project_key, p.project_name, p.description, p.created_at,
            COUNT(DISTINCT tc.test_case_id) AS test_count,
            COUNT(DISTINCT br.bug_id) AS bug_count
     FROM projects p
     LEFT JOIN test_cases tc ON tc.project_id = p.project_id
     LEFT JOIN bug_reports br ON br.project_id = p.project_id
     WHERE p.created_by = $1
     GROUP BY p.project_id
     ORDER BY p.created_at DESC`,
    [decoded.userId],
  );
  return res.status(200).json({ projects: rows });
}

async function createProject(req, res, decoded) {
  const { projectName, description } = req.body;
  if (!projectName) return res.status(400).json({ error: 'projectName is required' });

  // Auto-generate project key from name
  const projectKey = projectName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 10) + '-' + Date.now().toString(36).toUpperCase().slice(-4);

  const { rows } = await query(
    `INSERT INTO projects (project_key, project_name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING project_id, project_key, project_name, description, created_at`,
    [projectKey, projectName, description || null, decoded.userId],
  );

  return res.status(201).json({ project: rows[0] });
}

async function updateProject(req, res, decoded) {
  const { projectId, projectName, description } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const { rows } = await query(
    `UPDATE projects SET project_name = COALESCE($1, project_name),
                         description  = COALESCE($2, description),
                         updated_at   = NOW()
     WHERE project_id = $3 AND created_by = $4
     RETURNING project_id, project_key, project_name, description`,
    [projectName || null, description || null, projectId, decoded.userId],
  );

  if (!rows.length) return res.status(404).json({ error: 'Project not found or access denied' });
  return res.status(200).json({ project: rows[0] });
}

async function deleteProject(req, res, decoded) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'project id query param required' });

  const { rowCount } = await query(
    `DELETE FROM projects WHERE project_id = $1 AND created_by = $2`,
    [id, decoded.userId],
  );

  if (!rowCount) return res.status(404).json({ error: 'Project not found or access denied' });
  return res.status(200).json({ success: true });
}

// ============================================================
// api/health.js — Health check endpoint
// GET /api/health → { status: 'ok', db: 'connected', ts: '...' }
// ============================================================
// Note: Create this as a separate file: backend/api/health.js
