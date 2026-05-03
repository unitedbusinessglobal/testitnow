// ============================================================
// lib/auth.js — JWT helpers + middleware (Vercel Backend)
// ============================================================

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

// ── Token generation ─────────────────────────────────────────
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ── Token verification ────────────────────────────────────────
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── Password helpers ──────────────────────────────────────────
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ── Extract token from request ────────────────────────────────
export function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  // Also accept cookie (set by login route)
  const cookie = req.cookies?.token;
  return cookie || null;
}

// ── Auth middleware for Vercel API routes ─────────────────────
// Usage: const user = await requireAuth(req, res); if (!user) return;
export async function requireAuth(req, res) {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }

  try {
    const decoded = verifyToken(token);
    return decoded; // { userId, email, plan, role }
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// ── CORS helper ───────────────────────────────────────────────
// Call at top of every API route handler
export function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

  if (allowed.includes(origin) || allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // caller should return immediately
  }
  return false;
}

// ── Rate limiting (in-memory, per-serverless-instance) ────────
// For production use Upstash Redis + @upstash/ratelimit
const rateMap = new Map();
export function rateLimit(identifier, maxRequests = 20, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateMap.get(identifier) || { count: 0, reset: now + windowMs };

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }

  entry.count++;
  rateMap.set(identifier, entry);

  return entry.count > maxRequests;
}
