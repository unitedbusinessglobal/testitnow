// ============================================================
// PaymentModal.jsx — Stripe-powered payment modal
// Handles plan upgrade with real card collection via
// Stripe.js (no card data ever touches your server)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Crown, CreditCard, Lock, CheckCircle, Loader } from 'lucide-react';
import { PLANS } from '../../config/services';

// ── Load Stripe.js once ───────────────────────────────────────
let stripePromise = null;
function getStripe() {
  if (!stripePromise) {
    const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('[Stripe] REACT_APP_STRIPE_PUBLISHABLE_KEY not set');
      return Promise.resolve(null);
    }
    stripePromise = window.Stripe ? Promise.resolve(window.Stripe(key)) :
      new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => resolve(window.Stripe(key));
        document.head.appendChild(script);
      });
  }
  return stripePromise;
}

// ── Field component (outside — stable reference) ─────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', maxLength }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                 text-sm text-slate-200 placeholder-slate-500
                 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}

// ── Plan selector card ────────────────────────────────────────
function PlanCard({ plan, selected, onSelect }) {
  const isPopular = plan.id === 'pro';
  return (
    <button
      onClick={() => onSelect(plan.id)}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-900/30'
          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
          }`}>
            {selected && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <span className="font-semibold text-white text-sm">{plan.name}</span>
          {isPopular && (
            <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full font-medium">
              Popular
            </span>
          )}
        </div>
        <span className="font-bold text-white">
          {plan.price === null ? 'Custom' : plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
        </span>
      </div>
      <ul className="space-y-1 ml-6">
        {plan.features.slice(0, 3).map(f => (
          <li key={f} className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle size={10} className="text-emerald-400 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

// ── Main PaymentModal ─────────────────────────────────────────
export default function PaymentModal({ currentPlan, onSuccess, onClose }) {
  const [selectedPlanId, setSelectedPlanId] = useState('pro');
  const [step, setStep]         = useState('plan');   // 'plan' | 'card' | 'processing' | 'success'
  const [error, setError]       = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry]     = useState('');
  const [cvc, setCvc]           = useState('');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');

  const selectedPlan = PLANS[selectedPlanId];
  const upgradablePlans = Object.values(PLANS).filter(p => p.price > 0);

  // Format card number with spaces
  const handleCardNumber = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digits.replace(/(.{4})/g, '$1 ').trim());
  };

  // Format expiry MM/YY
  const handleExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };

  const handleProceedToCard = () => {
    if (selectedPlan.price === null) {
      // Enterprise — contact sales
      window.open('mailto:sales@testitnow.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    setStep('card');
    setError('');
  };

  const handlePayment = async () => {
    // Validate
    if (!name.trim())  { setError('Name on card is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 16) { setError('Enter a valid 16-digit card number'); return; }
    if (expiry.length < 5)   { setError('Enter a valid expiry date (MM/YY)'); return; }
    if (cvc.length < 3)      { setError('Enter a valid CVC'); return; }

    setStep('processing');
    setError('');

    try {
      const stripe = await getStripe();

      if (stripe) {
        // ── Real Stripe flow ──────────────────────────────────
        // 1. Create PaymentIntent on your backend
        const intentRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/payments/create-intent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('testitnow_token')}`,
            },
            body: JSON.stringify({ planId: selectedPlanId }),
          }
        );
        const { clientSecret, error: intentError } = await intentRes.json();
        if (intentError) throw new Error(intentError);

        // 2. Confirm card payment with Stripe.js
        const [expMonth, expYear] = expiry.split('/');
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          {
            payment_method: {
              card: {
                number:    rawCard,
                exp_month: parseInt(expMonth),
                exp_year:  parseInt(`20${expYear}`),
                cvc,
              },
              billing_details: { name, email },
            },
          }
        );

        if (stripeError) throw new Error(stripeError.message);

        // 3. Upgrade plan in your backend
        const upgradeRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/auth/upgrade`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('testitnow_token')}`,
            },
            body: JSON.stringify({
              planId: selectedPlanId,
              stripePaymentIntentId: paymentIntent.id,
            }),
          }
        );
        const upgradeData = await upgradeRes.json();
        if (!upgradeRes.ok) throw new Error(upgradeData.error);

        if (upgradeData.token) {
          localStorage.setItem('testitnow_token', upgradeData.token);
        }

        setStep('success');
        setTimeout(() => onSuccess(selectedPlanId, upgradeData), 2000);

      } else {
        // ── Demo mode (no Stripe key set) ────────────────────
        await new Promise(r => setTimeout(r, 2000));
        setStep('success');
        setTimeout(() => onSuccess(selectedPlanId, { plan: selectedPlanId, testsRemaining: 100 }), 2000);
      }
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
      setStep('card');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14
                        bg-yellow-500/20 border border-yellow-500/30 rounded-full mb-3">
          <Crown className="text-yellow-400" size={28} />
        </div>
        <h2 className="text-xl font-bold text-white">
          {step === 'success' ? '🎉 Welcome to ' + selectedPlan.name + '!' : 'Upgrade Your Plan'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {step === 'plan'       && 'Choose the plan that fits your needs'}
          {step === 'card'       && `Pay $${selectedPlan.price}/month — cancel anytime`}
          {step === 'processing' && 'Processing your payment…'}
          {step === 'success'    && 'Your account has been upgraded successfully'}
        </p>
      </div>

      {/* ── STEP 1: Plan selection ── */}
      {step === 'plan' && (
        <div className="space-y-3">
          {upgradablePlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlanId === plan.id}
              onSelect={setSelectedPlanId}
            />
          ))}
          <button
            onClick={handleProceedToCard}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600
                       hover:from-blue-500 hover:to-purple-500
                       text-white rounded-xl font-semibold text-sm transition-all"
          >
            {selectedPlan.price === null
              ? 'Contact Sales'
              : `Continue with ${selectedPlan.name} — $${selectedPlan.price}/mo →`}
          </button>
          <button onClick={onClose} className="w-full py-2 text-slate-400 text-sm hover:text-slate-300">
            Maybe later
          </button>
        </div>
      )}

      {/* ── STEP 2: Card details ── */}
      {step === 'card' && (
        <div className="space-y-3">
          {/* Order summary */}
          <div className="bg-slate-700/50 rounded-xl p-3 border border-slate-600/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-300">{selectedPlan.name} Plan</span>
              <span className="font-bold text-white">${selectedPlan.price}/mo</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Billed monthly · Cancel anytime</div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <Field label="Name on card">
            <Input value={name} onChange={setName} placeholder="John Smith" />
          </Field>

          <Field label="Email">
            <Input value={email} onChange={setEmail} placeholder="john@example.com" type="email" />
          </Field>

          <Field label="Card number">
            <div className="relative">
              <Input
                value={cardNumber}
                onChange={handleCardNumber}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
              <CreditCard size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry (MM/YY)">
              <Input value={expiry} onChange={handleExpiry} placeholder="MM/YY" maxLength={5} />
            </Field>
            <Field label="CVC">
              <Input value={cvc} onChange={setCvc} placeholder="123" maxLength={4} />
            </Field>
          </div>

          {/* Security badge */}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-700/30 rounded-lg px-3 py-2">
            <Lock size={12} className="text-emerald-400 shrink-0" />
            Secured by Stripe · 256-bit SSL encryption · PCI DSS compliant
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('plan')}
              className="flex-1 py-2.5 border border-slate-600 text-slate-300
                         rounded-xl text-sm hover:bg-slate-700"
            >
              ← Back
            </button>
            <button
              onClick={handlePayment}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600
                         hover:from-blue-500 hover:to-purple-500
                         text-white rounded-xl text-sm font-semibold"
            >
              Pay ${selectedPlan.price}/month
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Processing ── */}
      {step === 'processing' && (
        <div className="py-12 text-center space-y-4">
          <Loader className="animate-spin text-blue-400 mx-auto" size={48} />
          <p className="text-slate-300 text-sm">Processing your payment securely…</p>
          <p className="text-slate-500 text-xs">Please don't close this window</p>
        </div>
      )}

      {/* ── STEP 4: Success ── */}
      {step === 'success' && (
        <div className="py-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20
                          bg-emerald-500/20 border border-emerald-500/30 rounded-full">
            <CheckCircle className="text-emerald-400" size={40} />
          </div>
          <div>
            <p className="text-white font-semibold">Payment successful!</p>
            <p className="text-slate-400 text-sm mt-1">
              You now have access to all {selectedPlan.name} features
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-3 text-sm text-slate-300 space-y-1">
            {selectedPlan.features.map(f => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
