// ============================================================
// api/v1/payments/create-intent.js — Stripe PaymentIntent
// Called by PaymentModal before collecting card details
// ============================================================

import Stripe               from 'stripe';
import { query }            from '../../../lib/db.js';
import { requireAuth, setCors } from '../../../lib/auth.js';

const PLAN_PRICES = {
  pro:            { amount: 2900,  currency: 'usd', name: 'Pro Plan'            },
  small_business: { amount: 9900,  currency: 'usd', name: 'Small Business Plan' },
  premium:        { amount: 29900, currency: 'usd', name: 'Premium Plan'        },
};

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Demo mode when Stripe key not configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ clientSecret: 'demo_' + Date.now(), demo: true });
  }

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { planId } = req.body || {};
  const planPrice  = PLAN_PRICES[planId];
  if (!planPrice) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

    // Get or create Stripe customer
    const { rows } = await query(
      `SELECT stripe_customer_id, email, full_name FROM users WHERE user_id = $1`,
      [decoded.userId],
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.full_name,
        metadata: { userId: decoded.userId },
      });
      customerId = customer.id;
      await query(
        `UPDATE users SET stripe_customer_id = $1 WHERE user_id = $2`,
        [customerId, decoded.userId],
      );
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      planPrice.amount,
      currency:    planPrice.currency,
      customer:    customerId,
      description: planPrice.name,
      metadata:    { userId: decoded.userId, planId },
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('[payments/create-intent]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
