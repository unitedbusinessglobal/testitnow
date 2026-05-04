// ============================================================
// api/health.js — Health Check (Vercel)
// ============================================================
import { ping } from '../lib/db.js';
import { setCors } from '../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    const dbTime = await ping();
    return res.status(200).json({
      status: 'ok',
      db: 'connected',
      dbTime,
      env: process.env.NODE_ENV,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
}
