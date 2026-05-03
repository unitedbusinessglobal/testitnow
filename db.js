// ============================================================
// lib/db.js — Neon PostgreSQL connection (Vercel Backend)
// Uses @neondatabase/serverless for edge-compatible pooling
// ============================================================

import { neon, neonConfig } from '@neondatabase/serverless';
import { Pool } from '@neondatabase/serverless';

// Enable WebSocket pooling for Vercel Serverless Functions
neonConfig.webSocketConstructor = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');
neonConfig.poolQueryViaFetch = true;

// ── Single query helper (for simple one-shot queries) ─────────
// Use this for most API routes — no connection overhead
const sql = neon(process.env.DATABASE_URL);

// ── Connection pool (for transactions / multi-query routes) ───
let _pool = null;
export function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

// ── Execute a single SQL query ────────────────────────────────
export async function query(text, params = []) {
  try {
    const result = await sql(text, params);
    return { rows: result, rowCount: result.length };
  } catch (err) {
    console.error('[DB Error]', err.message, '| Query:', text);
    throw err;
  }
}

// ── Execute inside a transaction ──────────────────────────────
export async function withTransaction(fn) {
  const pool = getPool();
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
  const rows = await sql`SELECT NOW() as time`;
  return rows[0].time;
}

export default sql;
