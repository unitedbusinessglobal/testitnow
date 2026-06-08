// ============================================================
// lib/db.js — Neon PostgreSQL connection (Vercel Backend)
// FIX: removed require() (ESM module), lazy-init sql to avoid
//      cold-start crash when DATABASE_URL is not yet set
// ============================================================

import { neon, neonConfig, Pool } from '@neondatabase/serverless';

// Use native WebSocket in Node 20+ (no require('ws') needed)
neonConfig.poolQueryViaFetch = true;

// ── Lazy singletons — initialised on first use, not at module load ──
let _sql  = null;
let _pool = null;

function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

// ── Execute a single SQL query ────────────────────────────────
export async function query(text, params = []) {
  try {
    const sql = getSql();
    const result = await sql(text, params);
    return { rows: result, rowCount: result.length };
  } catch (err) {
    console.error('[DB Error]', err.message, '| Query:', text.substring(0, 120));
    throw err;
  }
}

// ── Execute inside a transaction ──────────────────────────────
export async function withTransaction(fn) {
  const pool   = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Health check ──────────────────────────────────────────────
export async function ping() {
  const sql  = getSql();
  const rows = await sql`SELECT NOW() as time`;
  return rows[0].time;
}
