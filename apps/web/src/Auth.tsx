import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import { z } from 'zod';
import { accountRequest, sessionSchema, useAuth } from './auth-state';
import { ThemeToggle } from './ThemeToggle';
import './auth.css';
import './auth-upgrade.css';
import './editorial.css';
import './auth-polish.css';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const signup = mode === 'signup';
  useEffect(() => {
    document.title = `${signup ? 'Get started' : 'Sign in'} · Fathom Clone`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        `${signup ? 'Create a Fathom Clone account' : 'Sign in to Fathom Clone'} to keep your meeting intelligence in one place.`,
      );
  }, [signup]);
  if (loading)
    return (
      <div className="auth-loading" role="status">
        <span className="auth-spinner" /> Checking your session…
      </div>
    );
  if (user) return <Navigate to="/app" replace />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!z.email().safeParse(email.trim()).success) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const response = z
        .union([
          sessionSchema,
          z.object({ confirmationRequired: z.literal(true) }),
        ])
        .parse(
          await accountRequest(mode, 'POST', {
            email: email.trim(),
            password,
          }),
        );
      if ('confirmationRequired' in response) {
        setConfirmation(true);
        return;
      }
      await refresh();
      navigate('/app', { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Something went wrong. Please retry.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="auth-page">
      <a className="skip-link" href="#auth-main">
        Skip to content
      </a>
      <section className="auth-story" aria-label="Fathom Clone product story">
        <Link className="auth-brand" to="/">
          <span>
            <AudioLines size={21} />
          </span>
          fathom <sup>clone</sup>
        </Link>
        <div className="auth-story-content">
          <span className="auth-eyebrow">
            <span /> THE CONVERSATION, KEPT CLEAR
          </span>
          <h2>
            All the meaning.
            <br />
            <em>Still within reach.</em>
          </h2>
          <p>
            Your recording becomes a transcript, a set of perspectives, and next
            steps that lead back to the words behind them.
          </p>
          <div className="auth-story-art" aria-hidden="true">
            <div>
              <span>TRANSCRIPT · 1:37</span>
              <p>“But my video is not getting recorded.”</p>
            </div>
            <i />
            <div>
              <Check size={16} />
              <span>Source linked to moment</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          Fathom Clone · Made for the moments that matter.
        </div>
      </section>
      <main className="auth-main" id="auth-main">
        <div className="auth-top">
          <Link className="auth-back" to="/">
            <ArrowLeft size={16} /> Back to Fathom Clone
          </Link>
          <ThemeToggle />
        </div>
        <div className="auth-form-wrap">
          {confirmation ? (
            <div className="auth-confirmation" role="status">
              <span className="auth-confirmation-mark">
                <Mail size={25} />
              </span>
              <h1>Check your inbox</h1>
              <p>
                We sent a confirmation link to <strong>{email}</strong>. Confirm
                your email to enter your workspace. If the link opens in another
                browser, sign in afterward.
              </p>
              <Link className="auth-submit" to="/login">
                Sign in <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <>
              <div className="auth-heading">
                <span className="auth-eyebrow">
                  <span /> {signup ? 'CREATE YOUR SPACE' : 'WELCOME BACK'}
                </span>
                <h1>
                  {signup
                    ? 'Make space for the next conversation.'
                    : 'Pick up where the meeting left off.'}
                </h1>
                <p>
                  {signup
                    ? 'Create an account to keep your recordings and their context together.'
                    : 'Sign in to return to your Fathom Clone workspace.'}
                </p>
              </div>
              <form onSubmit={(event) => void submit(event)} noValidate>
                <div className="auth-field">
                  <label htmlFor="auth-email">Email address</label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="auth-password">Password</label>
                  <div className="auth-password-wrap">
                    <input
                      id="auth-password"
                      type={visible ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        signup ? 'new-password' : 'current-password'
                      }
                      placeholder={
                        signup ? 'At least 8 characters' : 'Your password'
                      }
                      minLength={8}
                      required
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      aria-pressed={visible}
                      onClick={() => setVisible((value) => !value)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="auth-error" role="alert">
                    {error}
                  </div>
                )}
                <button
                  className="auth-submit"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="auth-spinner" />{' '}
                      {signup ? 'Creating account…' : 'Signing in…'}
                    </>
                  ) : (
                    <>
                      {signup ? 'Get started free' : 'Sign in'}{' '}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
              <p className="auth-switch">
                {signup ? 'Already have an account?' : 'New to Fathom Clone?'}{' '}
                <Link to={signup ? '/login' : '/signup'}>
                  {signup ? 'Sign in' : 'Get started free'}
                </Link>
              </p>
            </>
          )}
        </div>
        <div className="auth-security">
          <LockKeyhole size={14} /> Your uploaded meetings stay private until
          you share them.
        </div>
      </main>
    </div>
  );
}

export function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [link] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const access = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expires = Number(params.get('expires_in'));
    return {
      access,
      refreshToken,
      valid:
        !!access && !!refreshToken && Number.isFinite(expires) && expires > 0,
    };
  });
  const [error, setError] = useState(
    link.valid
      ? ''
      : 'This confirmation link cannot finish sign-in here. Your email may still be confirmed; please sign in.',
  );
  const completion = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    document.title = 'Confirm your account · Fathom Clone';
    if (!completion.current) {
      const access_token = link.access;
      const refresh_token = link.refreshToken;
      history.replaceState(null, '', '/auth/confirm');
      if (!link.valid || !access_token || !refresh_token) return;
      completion.current = accountRequest('complete', 'POST', {
        access_token,
        refresh_token,
      }).then(() => refresh());
    }
    let active = true;
    completion.current
      .then(() => {
        if (active) navigate('/app', { replace: true });
      })
      .catch(() => {
        if (active)
          setError(
            'Could not finish sign-in. Please use your confirmed email to sign in.',
          );
      });
    return () => {
      active = false;
    };
  }, [navigate, refresh, link]);
  return (
    <main className="auth-callback">
      <span className="auth-confirmation-mark">
        <Mail size={25} />
      </span>
      <h1>
        {error ? 'Email confirmation received' : 'Finishing your account…'}
      </h1>
      <p role={error ? 'alert' : 'status'}>
        {error || 'We are connecting your confirmed account to Fathom Clone.'}
      </p>
      {error && (
        <>
          <Link className="auth-submit" to="/login">
            Sign in <ArrowRight size={17} />
          </Link>
        </>
      )}
    </main>
  );
}
