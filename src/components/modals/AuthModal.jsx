// ============================================================
// AuthModal.jsx — Extracted to its own file so it NEVER
// re-mounts when App state changes (fixes cursor-jump bug).
// The Field component is defined at module scope — never
// recreated on re-render.
// ============================================================

import React, { useState } from 'react';
import { User } from 'lucide-react';

// ── Defined OUTSIDE all components — stable reference forever ─
function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                   text-sm text-slate-200 placeholder-slate-500
                   focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

// ── AuthModal — stable, no inner component definitions ────────
export default function AuthModal({ mode, onLogin, onSignup, onToggle }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handle = async () => {
    if (!email || !password) { setError('Email and password are required'); return; }
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onSignup(email, password, phone);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handle();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14
                        bg-blue-600/20 border border-blue-500/30 rounded-full mb-3">
          <User className="text-blue-400" size={28} />
        </div>
        <h2 className="text-xl font-bold text-white">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'login' ? 'Login to continue' : 'Start testing for free'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Fields */}
      <div onKeyDown={handleKeyDown} className="space-y-3">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="········"
        />
        {mode === 'signup' && (
          <Field
            label="Phone (optional — for promos)"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+1 234 567 8900"
          />
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handle}
        disabled={loading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                   text-white rounded-lg font-semibold text-sm transition-colors"
      >
        {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Sign Up Free'}
      </button>

      {/* Toggle */}
      <p className="text-center text-xs text-slate-400">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={onToggle}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          {mode === 'login' ? 'Sign Up' : 'Login'}
        </button>
      </p>
    </div>
  );
}
