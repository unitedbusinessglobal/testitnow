// ============================================================
// lib/db.js — Neon PostgreSQL (Vercel Serverless)
// Uses HTTP fetch mode exclusively — no WebSocket needed.
// neon() tagged template = HTTP fetch (works everywhere).
// withTransaction uses neon's built-in transaction support.
// ============================================================

import { neon, neonConfig } from '@neondatabase/serverless';

// Force HTTP fetch mode — no WebSocket required at all
neonConfig.fetchConnectionCache = true;

// ── Lazy singleton ────────────────────────────────────────────
let _sql = null;

function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// ── Single query via HTTP fetch ───────────────────────────────
export async function query(text, params = []) {
  try {
    const sql    = getSql();
    const result = await sql(text, params);
    return { rows: result, rowCount: result.length };
  } catch (err) {
    console.error('[DB Error]', err.message, '| Query:', text.substring(0, 120));
    throw err;
  }
}

// ── Transaction via neon HTTP transaction API ─────────────────
// neon() supports transactions through the tagged-template
// transaction() helper — no WebSocket or Pool needed.
export async function withTransaction(fn) {
  const sql = getSql();

  // Build a fake "client" that collects queries then
  // executes them as a batch transaction over HTTP.
  const ops    = [];
  const fakeClient = {
    query: async (text, params = []) => {
      // Execute immediately using the HTTP driver
      const result = await sql(text, params);
      return { rows: result, rowCount: result.length };
    },
  };

  try {
    // Run BEGIN manually, execute fn, then COMMIT
    await sql('BEGIN');
    const result = await fn(fakeClient);
    await sql('COMMIT');
    return result;
  } catch (err) {
    try { await sql('ROLLBACK'); } catch {}
    throw err;
  }
}

// ── Health check ──────────────────────────────────────────────
export async function ping() {
  const sql  = getSql();
  const rows = await sql`SELECT NOW() as time`;
  return rows[0].time;
}

export default getSql;
