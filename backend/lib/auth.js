// ============================================================
// lib/auth.js — JWT helpers + middleware (Vercel Backend)
// FIX: JWT_SECRET validated lazily (no throw at module load)
//      so cold starts don't crash if env var loads after import
// ============================================================

import jwt        from 'jsonwebtoken';
import bcrypt     from 'bcryptjs';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return s;
}

const JWT_EXPIRES = () => process.env.JWT_EXPIRES_IN || '7d';

// ── Token generation ─────────────────────────────────────────
export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES() });
}

// ── Token verification ────────────────────────────────────────
export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

// ── Password helpers ──────────────────────────────────────────
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ── Extract token from Authorization header ───────────────────
export function extractToken(req) {
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies?.token || null;
}

// ── Auth middleware ───────────────────────────────────────────
export async function requireAuth(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  try {
    return verifyToken(token); // { userId, email, plan, role }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// ── CORS helper ───────────────────────────────────────────────
export function setCors(req, res) {
  const origin  = req.headers?.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());

  if (allowed.includes('*') || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods',  'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',  'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ── Simple in-memory rate limiter ────────────────────────────
const rateMap = new Map();
export function rateLimit(identifier, maxRequests = 20, windowMs = 60_000) {
  const now   = Date.now();
  const entry = rateMap.get(identifier) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count++;
  rateMap.set(identifier, entry);
  return entry.count > maxRequests;
}
