// ============================================================
// api/v1/auth/[action].js — Auth API Route (Vercel Serverless)
// Handles: /api/v1/auth/login  /signup  /me  /logout  /upgrade
//
// Maps to → authService.js on the frontend
// Database → Neon: users table
// ============================================================

import { query, withTransaction } from '../../../lib/db.js';
import {
  signToken, requireAuth, hashPassword, comparePassword, setCors, rateLimit,
} from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return; // handle preflight

  const { action } = req.query;

  // Per-IP rate limiting on auth endpoints
  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (rateLimit(`auth:${ip}`, 15, 60_000)) {
    return res.status(429).json({ error: 'Too many requests — try again later' });
  }

  try {
    switch (action) {
      case 'login':    return await login(req, res);
      case 'signup':   return await signup(req, res);
      case 'me':       return await me(req, res);
      case 'logout':   return await logout(req, res);
      case 'upgrade':  return await upgrade(req, res);
      default:
        return res.status(404).json({ error: `Unknown auth action: ${action}` });
    }
  } catch (err) {
    console.error(`[auth/${action}]`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v1/auth/login ───────────────────────────────────
async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { rows } = await query(
    `SELECT user_id, email, full_name, password_hash, plan_type, tests_remaining, role, is_active
     FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  const user = rows[0];

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // OAuth-only accounts have no password
  if (!user.password_hash) {
    return res.status(401).json({ error: 'Please log in with your social account' });
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Update last_login
  await query(`UPDATE users SET last_login = NOW() WHERE user_id = $1`, [user.user_id]);

  const token = signToken({
    userId: user.user_id,
    email: user.email,
    plan: user.plan_type,
    role: user.role,
  });

  return res.status(200).json({
    token,
    user: {
      id: user.user_id,
      email: user.email,
      name: user.full_name,
      plan: user.plan_type,
      testsRemaining: user.tests_remaining,
      role: user.role,
    },
  });
}

// ── POST /api/v1/auth/signup ──────────────────────────────────
async function signup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, fullName, phone } = req.body;

  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const emailNorm = email.toLowerCase().trim();

  // Check duplicate
  const { rows: existing } = await query(
    `SELECT user_id FROM users WHERE email = $1 LIMIT 1`,
    [emailNorm],
  );
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, phone, plan_type, tests_remaining)
     VALUES ($1, $2, $3, $4, 'free', 5)
     RETURNING user_id, email, full_name, plan_type, tests_remaining, role`,
    [emailNorm, passwordHash, fullName || emailNorm.split('@')[0], phone || null],
  );

  const user = rows[0];
  const token = signToken({
    userId: user.user_id,
    email: user.email,
    plan: user.plan_type,
    role: user.role,
  });

  return res.status(201).json({
    token,
    user: {
      id: user.user_id,
      email: user.email,
      name: user.full_name,
      plan: user.plan_type,
      testsRemaining: user.tests_remaining,
      role: user.role,
    },
  });
}

// ── GET /api/v1/auth/me ───────────────────────────────────────
async function me(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { rows } = await query(
    `SELECT user_id, email, full_name, phone, avatar_url, plan_type, tests_remaining, role,
            company, created_at, last_login
     FROM users WHERE user_id = $1 LIMIT 1`,
    [decoded.userId],
  );

  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.status(200).json({ user });
}

// ── POST /api/v1/auth/logout ──────────────────────────────────
async function logout(req, res) {
  // JWTs are stateless; client drops the token.
  // For token blocklist add to Redis: await redis.set(`blocked:${token}`, 1, { ex: 7 * 86400 })
  return res.status(200).json({ success: true });
}

// ── POST /api/v1/auth/upgrade ─────────────────────────────────
async function upgrade(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { planId, stripePaymentIntentId } = req.body;
  const validPlans = ['pro', 'small_business', 'premium'];
  if (!validPlans.includes(planId)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  // Fetch plan limits from DB
  const { rows: planRows } = await query(
    `SELECT max_test_runs FROM subscription_plans WHERE plan_type = $1 LIMIT 1`,
    [planId],
  );
  const plan = planRows[0];
  if (!plan) return res.status(400).json({ error: 'Plan not found' });

  // TODO: Verify stripePaymentIntentId with Stripe SDK before updating plan
  // const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
  // if (paymentIntent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not confirmed' });

  const testsRemaining = plan.max_test_runs === -1 ? 999999 : plan.max_test_runs;

  await query(
    `UPDATE users SET plan_type = $1, tests_remaining = $2, updated_at = NOW()
     WHERE user_id = $3`,
    [planId, testsRemaining, decoded.userId],
  );

  // Issue new token with updated plan
  const token = signToken({ ...decoded, plan: planId });

  return res.status(200).json({
    success: true,
    token,
    plan: planId,
    testsRemaining,
  });
}
