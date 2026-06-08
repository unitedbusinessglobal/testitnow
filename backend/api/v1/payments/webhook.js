// ============================================================
// api/v1/payments/webhook.js — Stripe Webhook Handler
// Verifies Stripe events and upgrades user plan in Neon
// Register this URL in Stripe Dashboard → Webhooks:
//   https://testitnow-prod.vercel.app/api/v1/payments/webhook
// ============================================================

import Stripe           from 'stripe';
import { query }        from '../../../lib/db.js';
import { setCors }      from '../../../lib/auth.js';

export const config = { api: { bodyParser: false } }; // Stripe needs raw body

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const PLAN_RUN_LIMITS = {
  pro:            100,
  small_business: 500,
  premium:        999999,
};

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ received: true, demo: true });
  }

  const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const rawBody   = await getRawBody(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi     = event.data.object;
        const userId = pi.metadata?.userId;
        const planId = pi.metadata?.planId;

        if (userId && planId) {
          const testsRemaining = PLAN_RUN_LIMITS[planId] ?? 5;
          await query(
            `UPDATE users SET plan_type = $1, tests_remaining = $2, updated_at = NOW()
             WHERE user_id = $3`,
            [planId, testsRemaining, userId],
          );
          console.log(`[webhook] Upgraded user ${userId} to ${planId}`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.warn(`[webhook] Payment failed for user ${pi.metadata?.userId}`);
        break;
      }

      default:
        console.log(`[webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err.message);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
