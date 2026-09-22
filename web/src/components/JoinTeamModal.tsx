import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { apiAuthCheckEmail, useMockData } from '../api/client';
import {
  createAuthAccount,
  getAccountByEmail,
  verifyPassword,
} from '../utils/authStore';
import { getMemberByEmail, upsertMember } from '../utils/roleStore';
import { EventOSWordmark } from './EventOSWordmark';
import { EventOSLogo } from '../brand/EventOSLogo';
import './JoinTeamModal.css';

type Step = 'email' | 'password' | 'not_found' | 'register';

export function JoinTeamModal() {
  const { user, setUser, isReady } = useUser();
  const location = useLocation();

  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const emailRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef     = useRef<HTMLInputElement>(null);

  // Auto-focus the first field on each step
  useEffect(() => {
    if (step === 'email')    emailRef.current?.focus();
    if (step === 'password') passwordRef.current?.focus();
    if (step === 'register') nameRef.current?.focus();
  }, [step]);

  // The vendor portal is a public, token-only page — vendors never have (or
  // need) an EventOS account, so this sign-in gate must never cover it.
  if (location.pathname.startsWith('/vendor/')) return null;

  if (!isReady || user) return null;

  // ── Step handlers ────────────────────────────────────────────────────────

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      let exists = !!getAccountByEmail(trimmed);
      if (!exists && !useMockData()) {
        try {
          exists = await apiAuthCheckEmail(trimmed);
        } catch (err) {
          // Older GAS deployment without authCheckEmail — still allow sign-in attempt
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('Unknown action')) {
            exists = true;
          } else {
            throw err;
          }
        }
      }
      setEmail(trimmed);
      setStep(exists ? 'password' : 'not_found');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg
          ? msg
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      const account = await verifyPassword(email, password);
      if (!account) {
        setError('Incorrect password. Please try again.');
        return;
      }
      setUser({ name: account.name, email: account.email });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim())  { setError('Please enter your full name.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const account = await createAuthAccount(name.trim(), email, password);

      // Ensure the user exists in the org members store
      if (!getMemberByEmail(email)) {
        upsertMember({
          id: `member-${Date.now()}`,
          name: account.name,
          email: account.email,
          role: 'project_lead',
          status: 'active',
          createdAt: account.createdAt,
          invitedBy: '',
        });
      }

      setUser({ name: account.name, email: account.email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setError('');
    setPassword('');
    setConfirm('');
    setStep('email');
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="login-overlay" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="login-card">

        {/* Logo + wordmark — light/dark variants, toggled by prefers-color-scheme */}
        <div className="login-brand">
          <EventOSWordmark iconSize={40} textSize="1.7rem" className="login-logo login-logo--light" />
          <EventOSLogo size={3} className="login-logo login-logo--dark" />
        </div>

        {/* ── Step: Email ── */}
        {step === 'email' && (
          <form onSubmit={handleEmailContinue} noValidate>
            <h1 className="login-title">Welcome to EventOS</h1>
            <p className="login-sub">
              Don't have an account?{' '}
              <span className="login-hint">Enter your email to get started.</span>
            </p>

            <div className="login-field">
              <label htmlFor="login-email">Work email</label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="login-btn login-btn--primary"
              disabled={loading}
            >
              {loading ? 'Checking…' : 'Continue to EventOS'}
            </button>
          </form>
        )}

        {/* ── Step: Password ── */}
        {step === 'password' && (
          <form onSubmit={handleSignIn} noValidate>
            <button type="button" className="login-back" onClick={goBack}>
              ← Back
            </button>
            <h1 className="login-title">Welcome back</h1>
            <p className="login-email-chip">{email}</p>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-pwd-wrap">
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="login-btn login-btn--primary"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {/* ── Step: No account found ── */}
        {step === 'not_found' && (
          <div>
            <button type="button" className="login-back" onClick={goBack}>
              ← Back
            </button>
            <h1 className="login-title">No account found</h1>
            <p className="login-sub">
              We couldn't find an account for{' '}
              <strong className="login-email-inline">{email}</strong>.
            </p>

            {error && <p className="login-error">{error}</p>}

            <button
              type="button"
              className="login-btn login-btn--primary"
              onClick={() => { setError(''); setStep('register'); }}
            >
              Create an account
            </button>
          </div>
        )}

        {/* ── Step: Register ── */}
        {step === 'register' && (
          <form onSubmit={handleRegister} noValidate>
            <button type="button" className="login-back" onClick={() => setStep('not_found')}>
              ← Back
            </button>
            <h1 className="login-title">Create your account</h1>
            <p className="login-email-chip">{email}</p>

            <div className="login-field">
              <label htmlFor="reg-name">Full name</label>
              <input
                id="reg-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="reg-password">Password</label>
              <div className="login-pwd-wrap">
                <input
                  id="reg-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="login-pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm"
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="login-btn login-btn--primary"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
