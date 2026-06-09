// ============================================================
// api/v1/sources/index.js — Source Management API (Vercel)
// Handles: URL history, GitHub/GitLab repos, source code uploads
// GET    /api/v1/sources              → list user's sources
// POST   /api/v1/sources              → add/upsert source
// DELETE /api/v1/sources?id=xxx       → delete source
// GET    /api/v1/sources?action=cached → get cached analysis
// ============================================================

import { query }                    from '../../../lib/db.js';
import { requireAuth, setCors }     from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { action } = req.query;

  try {
    if (action === 'cached') return await getCached(req, res, decoded);

    switch (req.method) {
      case 'GET':    return await listSources(req, res, decoded);
      case 'POST':   return await upsertSource(req, res, decoded);
      case 'DELETE': return await deleteSource(req, res, decoded);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[sources]', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}

async function listSources(req, res, decoded) {
  const { rows } = await query(
    `SELECT s.source_id, s.source_type, s.label, s.url, s.repo_owner,
            s.repo_name, s.branch, s.last_analyzed_at, s.analysis_count,
            s.cached_test_count, s.status, s.created_at
     FROM sources s
     WHERE s.user_id = $1
     ORDER BY s.last_analyzed_at DESC NULLS LAST, s.created_at DESC`,
    [decoded.userId],
  );
  return res.status(200).json({ sources: rows });
}

async function upsertSource(req, res, decoded) {
  const { sourceType, label, url, repoOwner, repoName, branch, accessToken } = req.body || {};
  if (!sourceType) return res.status(400).json({ error: 'sourceType is required' });

  const fingerprint = sourceType === 'url'
    ? (url || '').toLowerCase().trim()
    : sourceType === 'upload'
    ? `upload:${decoded.userId}:${Date.now()}`
    : `${repoOwner}/${repoName}@${branch || 'main'}`;

  const { rows } = await query(
    `INSERT INTO sources
       (user_id, source_type, label, url, repo_owner, repo_name, branch,
        access_token_hint, fingerprint, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
     ON CONFLICT (user_id, fingerprint)
     DO UPDATE SET
       label          = COALESCE(EXCLUDED.label, sources.label),
       url            = COALESCE(EXCLUDED.url, sources.url),
       branch         = COALESCE(EXCLUDED.branch, sources.branch),
       status         = 'active',
       updated_at     = NOW()
     RETURNING source_id, source_type, label, url, repo_owner, repo_name,
               branch, fingerprint, status, created_at,
               analysis_count, cached_test_count, last_analyzed_at`,
    [
      decoded.userId, sourceType,
      label || url || `${repoOwner}/${repoName}` || 'Uploaded source',
      url || null, repoOwner || null, repoName || null, branch || 'main',
      accessToken ? accessToken.substring(0, 6) + '****' : null,
      fingerprint,
    ],
  );

  return res.status(200).json({ source: rows[0] });
}

async function deleteSource(req, res, decoded) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  await query(`DELETE FROM sources WHERE source_id = $1 AND user_id = $2`, [id, decoded.userId]);
  return res.status(200).json({ success: true });
}

async function getCached(req, res, decoded) {
  const { sourceId } = req.query;
  if (!sourceId) return res.status(400).json({ error: 'sourceId required' });

  const { rows: srcRows } = await query(
    `SELECT source_id, label, url, source_type, last_analyzed_at,
            cached_test_count, analysis_count, status
     FROM sources WHERE source_id = $1 AND user_id = $2`,
    [sourceId, decoded.userId],
  );
  if (!srcRows.length) return res.status(404).json({ error: 'Source not found' });

  const source = srcRows[0];

  const { rows: testRows } = await query(
    `SELECT test_case_id, test_case_key, test_case_type, summary,
            description, preconditions, test_steps, test_data,
            expected_result, priority, status
     FROM test_cases WHERE source_id = $1
     ORDER BY test_case_type, created_at ASC`,
    [sourceId],
  );

  const generated = { ui:[], api:[], security:[], performance:[], database:[], unit:[] };
  testRows.forEach(tc => {
    const type = tc.test_case_type || 'unit';
    if (generated[type]) {
      generated[type].push({
        id:             tc.test_case_key,
        name:           tc.summary,
        description:    tc.description,
        preconditions:  tc.preconditions,
        testSteps:      tc.test_steps?.steps?.join(' | ') || '',
        testData:       tc.test_data?.data || '',
        expectedResult: tc.expected_result,
        priority:       tc.priority,
        status:         tc.status,
        dbId:           tc.test_case_id,
        dbKey:          tc.test_case_key,
      });
    }
  });

  return res.status(200).json({ source, generated, cached: true, totalCached: testRows.length });
}
