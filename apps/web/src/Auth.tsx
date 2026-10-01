import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
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

/** Only same-site app paths may be used as a post-sign-in destination. */
export function safeNext(value: string | null) {
  return value && /^\/app(\/|$|\?)/.test(value) ? value : '/app';
}

function AuthLayout({ children }: { children: React.ReactNode }) {
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
              <span>TRANSCRIPT · 12:47</span>
              <p>“Let’s send the revised proposal by Friday.”</p>
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
        <div className="auth-form-wrap">{children}</div>
        <div className="auth-security">
          <LockKeyhole size={14} /> Your meetings stay private until you share
          them.
        </div>
      </main>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={8}
          required
          disabled={disabled}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({
  busy,
  busyLabel,
  label,
}: {
  busy: boolean;
  busyLabel: string;
  label: string;
}) {
  return (
    <button className="auth-submit" type="submit" disabled={busy}>
      {busy ? (
        <>
          <span className="auth-spinner" /> {busyLabel}
        </>
      ) : (
        <>
          {label} <ArrowRight size={17} />
        </>
      )}
    </button>
  );
}

function errorText(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'Something went wrong. Please retry.';
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const signup = mode === 'signup';
  useEffect(() => {
    document.title = `${signup ? 'Get started' : 'Sign in'} · Fathom Clone`;
  }, [signup]);
  if (loading)
    return (
      <div className="auth-loading" role="status">
        <span className="auth-spinner" /> Checking your session…
      </div>
    );
  if (user) return <Navigate to={next} replace />;
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
      navigate(next, { replace: true });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <AuthLayout>
      {confirmation ? (
        <div className="auth-confirmation" role="status">
          <span className="auth-confirmation-mark">
            <Mail size={25} />
          </span>
          <h1>Check your inbox</h1>
          <p>
            We sent a confirmation link to <strong>{email}</strong>. Open it in
            this browser to enter your workspace, or sign in afterward.
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
            <PasswordField
              id="auth-password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete={signup ? 'new-password' : 'current-password'}
              placeholder={signup ? 'At least 8 characters' : 'Your password'}
              disabled={submitting}
            />
            {!signup && (
              <p className="auth-forgot">
                <Link to="/forgot-password">Forgot password?</Link>
              </p>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <SubmitButton
              busy={submitting}
              busyLabel={signup ? 'Creating account…' : 'Signing in…'}
              label={signup ? 'Get started free' : 'Sign in'}
            />
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to Fathom Clone?'}{' '}
            <Link to={signup ? '/login' : '/signup'}>
              {signup ? 'Sign in' : 'Get started free'}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    document.title = 'Reset your password · Fathom Clone';
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!z.email().safeParse(email.trim()).success) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await accountRequest('recover', 'POST', { email: email.trim() });
      setSent(true);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <AuthLayout>
      {sent ? (
        <div className="auth-confirmation" role="status">
          <span className="auth-confirmation-mark">
            <Mail size={25} />
          </span>
          <h1>Check your inbox</h1>
          <p>
            If <strong>{email}</strong> has an account, we sent a link to
            choose a new password. It expires in one hour.
          </p>
          <Link className="auth-submit" to="/login">
            Back to sign in <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <>
          <div className="auth-heading">
            <span className="auth-eyebrow">
              <span /> RESET PASSWORD
            </span>
            <h1>Forgot your password?</h1>
            <p>Enter your email and we’ll send you a link to choose a new one.</p>
          </div>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <div className="auth-field">
              <label htmlFor="forgot-email">Email address</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
                disabled={submitting}
              />
            </div>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <SubmitButton
              busy={submitting}
              busyLabel="Sending link…"
              label="Send reset link"
            />
          </form>
          <p className="auth-switch">
            Remembered it? <Link to="/login">Sign in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}

/** Reads the tokens an emailed link carries in its URL fragment, once. */
function useLinkTokens(path: string) {
  const [link] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    history.replaceState(null, '', path);
    return access_token && refresh_token
      ? { access_token, refresh_token }
      : null;
  });
  return link;
}

export function ResetPassword() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const link = useLinkTokens('/auth/reset');
  const session = useRef<Promise<unknown> | null>(null);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(
    link ? '' : 'This reset link is invalid or has expired.',
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    document.title = 'Choose a new password · Fathom Clone';
    if (!link) return;
    session.current ??= accountRequest('recovery', 'POST', link);
    let active = true;
    session.current
      .then(() => active && setReady(true))
      .catch(
        () => active && setLinkError('This reset link is invalid or has expired.'),
      );
    return () => {
      active = false;
    };
  }, [link]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords don’t match.');
      return;
    }
    setSubmitting(true);
    try {
      await accountRequest('password', 'POST', { password });
      await refresh();
      navigate('/app', { replace: true });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <AuthLayout>
      {linkError ? (
        <div className="auth-confirmation" role="alert">
          <span className="auth-confirmation-mark">
            <LockKeyhole size={25} />
          </span>
          <h1>Link expired</h1>
          <p>{linkError} Request a new one to continue.</p>
          <Link className="auth-submit" to="/forgot-password">
            Request a new link <ArrowRight size={17} />
          </Link>
        </div>
      ) : !ready ? (
        <div className="auth-loading" role="status">
          <span className="auth-spinner" /> Checking your reset link…
        </div>
      ) : (
        <>
          <div className="auth-heading">
            <span className="auth-eyebrow">
              <span /> NEW PASSWORD
            </span>
            <h1>Choose a new password.</h1>
            <p>You’ll stay signed in on this browser afterward.</p>
          </div>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <PasswordField
              id="reset-password"
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={submitting}
            />
            <PasswordField
              id="reset-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              disabled={submitting}
            />
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <SubmitButton
              busy={submitting}
              busyLabel="Saving…"
              label="Save new password"
            />
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const link = useLinkTokens('/auth/confirm');
  const [error, setError] = useState(
    link
      ? ''
      : 'This confirmation link cannot finish sign-in here. Your email may still be confirmed; please sign in.',
  );
  const completion = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    document.title = 'Confirm your account · Fathom Clone';
    if (!link) return;
    completion.current ??= accountRequest('complete', 'POST', link).then(() =>
      refresh(),
    );
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
