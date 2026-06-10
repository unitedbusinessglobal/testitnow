// ============================================================
// api/v1/auth/[action].js — Auth API Route (Vercel Serverless)
// ============================================================

import { query }                                              from '../../../lib/db.js';
import { signToken, requireAuth, hashPassword,
         comparePassword, setCors, rateLimit }                from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  // ── Guard: check env vars are present before doing anything ─
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server misconfiguration: DATABASE_URL not set' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
  }

  const { action } = req.query;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  if (rateLimit(`auth:${ip}`, 15, 60_000)) {
    return res.status(429).json({ error: 'Too many requests — try again later' });
  }

  try {
    switch (action) {
      case 'login':   return await login(req, res);
      case 'signup':  return await signup(req, res);
      case 'me':      return await me(req, res);
      case 'logout':  return await logout(req, res);
      case 'upgrade': return await upgrade(req, res);
      default:
        return res.status(404).json({ error: `Unknown auth action: ${action}` });
    }
  } catch (err) {
    // Return the real error message in non-production so you can debug
    console.error(`[auth/${action}] ERROR:`, err.message, err.stack);
    const detail = process.env.NODE_ENV !== 'production' ? err.message : undefined;
    return res.status(500).json({ error: 'Internal server error', detail });
  }
}

// ── POST /api/v1/auth/signup ──────────────────────────────────
async function signup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, fullName, phone } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const emailNorm = email.toLowerCase().trim();

  // Check for duplicate
  const { rows: existing } = await query(
    `SELECT user_id FROM users WHERE email = $1 LIMIT 1`,
    [emailNorm],
  );
  if (existing.length) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, phone, plan_type, tests_remaining)
     VALUES ($1, $2, $3, $4, 'free', 5)
     RETURNING user_id, email, full_name, plan_type, tests_remaining, role`,
    [
      emailNorm,
      passwordHash,
      fullName || emailNorm.split('@')[0],
      phone || null,
    ],
  );

  const user = rows[0];
  const token = signToken({
    userId: user.user_id,
    email:  user.email,
    plan:   user.plan_type,
    role:   user.role,
  });

  return res.status(201).json({
    token,
    user: {
      id:             user.user_id,
      email:          user.email,
      name:           user.full_name,
      plan:           user.plan_type,
      testsRemaining: user.tests_remaining,
      role:           user.role,
    },
  });
}

// ── POST /api/v1/auth/login ───────────────────────────────────
async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { rows } = await query(
    `SELECT user_id, email, full_name, password_hash, plan_type,
            tests_remaining, role, is_active
     FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.password_hash) {
    return res.status(401).json({ error: 'Please log in with your social account' });
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await query(
    `UPDATE users SET last_login = NOW() WHERE user_id = $1`,
    [user.user_id],
  );

  const token = signToken({
    userId: user.user_id,
    email:  user.email,
    plan:   user.plan_type,
    role:   user.role,
  });

  return res.status(200).json({
    token,
    user: {
      id:             user.user_id,
      email:          user.email,
      name:           user.full_name,
      plan:           user.plan_type,
      testsRemaining: user.tests_remaining,
      role:           user.role,
    },
  });
}

// ── GET /api/v1/auth/me ───────────────────────────────────────
async function me(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { rows } = await query(
    `SELECT user_id, email, full_name, phone, avatar_url, plan_type,
            tests_remaining, role, company, created_at, last_login
     FROM users WHERE user_id = $1 LIMIT 1`,
    [decoded.userId],
  );

  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  return res.status(200).json({ user: rows[0] });
}

// ── POST /api/v1/auth/logout ──────────────────────────────────
async function logout(req, res) {
  return res.status(200).json({ success: true });
}

// ── POST /api/v1/auth/upgrade ─────────────────────────────────
async function upgrade(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { planId } = req.body || {};
  const validPlans = ['pro', 'small_business', 'premium'];
  if (!validPlans.includes(planId)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const { rows: planRows } = await query(
    `SELECT max_test_runs FROM subscription_plans WHERE plan_type = $1 LIMIT 1`,
    [planId],
  );
  if (!planRows[0]) return res.status(400).json({ error: 'Plan not found in database' });

  const testsRemaining = planRows[0].max_test_runs === -1
    ? 999999
    : planRows[0].max_test_runs;

  await query(
    `UPDATE users SET plan_type = $1, tests_remaining = $2, updated_at = NOW()
     WHERE user_id = $3`,
    [planId, testsRemaining, decoded.userId],
  );

  const token = signToken({ ...decoded, plan: planId });

  return res.status(200).json({ success: true, token, plan: planId, testsRemaining });
}
