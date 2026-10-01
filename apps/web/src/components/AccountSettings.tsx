import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { KeyRound, LoaderCircle, Mail, Trash2, X } from 'lucide-react';
import { accountRequest, useAuth } from '../auth-state';
import './upload.css';
import './settings.css';

function message(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'Something went wrong. Please retry.';
}

function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8)
      return setStatus({
        ok: false,
        text: 'Use a password with at least 8 characters.',
      });
    if (password !== confirm)
      return setStatus({ ok: false, text: 'The passwords don’t match.' });
    setBusy(true);
    setStatus(null);
    try {
      await accountRequest('password', 'POST', { password });
      setPassword('');
      setConfirm('');
      setStatus({ ok: true, text: 'Password updated.' });
    } catch (reason) {
      setStatus({ ok: false, text: message(reason) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="settings-card" onSubmit={(e) => void submit(e)} noValidate>
      <div className="settings-card-heading">
        <KeyRound size={18} />
        <h2>Change password</h2>
      </div>
      <label className="settings-field">
        New password
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={busy}
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="settings-field">
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          disabled={busy}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      {status && (
        <p
          className={status.ok ? 'settings-success' : 'upload-error'}
          role={status.ok ? 'status' : 'alert'}
        >
          {status.text}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy && <LoaderCircle size={15} className="loading-icon" />}
        {busy ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}

function DeleteAccount() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await accountRequest('delete-account', 'POST', { password });
      await auth.refresh().catch(() => null);
      navigate('/', { replace: true });
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-card settings-danger">
      <div className="settings-card-heading">
        <Trash2 size={18} />
        <h2>Delete account</h2>
      </div>
      <p>
        Permanently delete your account, every recording, transcript, summary,
        moment, and public link. This cannot be undone.
      </p>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
          setPassword('');
          setError('');
        }}
      >
        <Dialog.Trigger className="delete-confirm-button">
          <Trash2 size={15} /> Delete my account
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content delete-meeting-dialog">
            <span className="delete-dialog-icon" aria-hidden="true">
              <Trash2 size={20} />
            </span>
            <Dialog.Title>Delete your account?</Dialog.Title>
            <Dialog.Description>
              Everything in your workspace will be removed permanently. Enter
              your password to confirm.
            </Dialog.Description>
            <form onSubmit={(e) => void remove(e)}>
              <label className="settings-field">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={busy}
                  autoFocus
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {error && (
                <p className="delete-dialog-error" role="alert">
                  {error}
                </p>
              )}
              <div className="delete-dialog-actions">
                <Dialog.Close
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  className="delete-confirm-button"
                  disabled={busy || password.length < 8}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="loading-icon" size={15} />{' '}
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} /> Delete permanently
                    </>
                  )}
                </button>
              </div>
            </form>
            <Dialog.Close
              className="icon-button dialog-close"
              aria-label="Close delete dialog"
              disabled={busy}
            >
              <X size={19} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

export function AccountSettings() {
  const { user } = useAuth();
  useEffect(() => {
    document.title = 'Settings · Fathom Clone';
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR ACCOUNT</div>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-layout">
        <section className="settings-card">
          <div className="settings-card-heading">
            <Mail size={18} />
            <h2>Email</h2>
          </div>
          <p className="settings-value">{user?.email}</p>
        </section>
        <ChangePassword />
        <DeleteAccount />
      </div>
    </>
  );
}
