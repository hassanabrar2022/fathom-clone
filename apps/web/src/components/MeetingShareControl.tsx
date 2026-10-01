import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { meetingShareStatusSchema } from '../../../../packages/shared/sharing';
import { uploadApi } from '../data/uploads';
import './meeting-share.css';

export function MeetingShareControl({
  meetingId,
  privateMeeting = false,
}: {
  meetingId: string;
  privateMeeting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let disposed = false;
    uploadApi(`${privateMeeting ? 'uploads' : 'meetings'}/${meetingId}/share`)
      .then((data) => {
        if (disposed) return;
        setPath(meetingShareStatusSchema.parse(data).path);
        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });
    return () => {
      disposed = true;
    };
  }, [meetingId, privateMeeting, attempt]);

  async function changeShare(method: 'POST' | 'DELETE') {
    setBusy(true);
    setNotice('');
    try {
      const result = meetingShareStatusSchema.parse(
        await uploadApi(`uploads/${meetingId}/share`, method),
      );
      setPath(result.path);
      setNotice(
        method === 'DELETE'
          ? 'Link revoked. It no longer opens this meeting.'
          : 'Public link ready. Anyone with it can view this meeting.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Sharing could not be updated. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(
        new URL(path, window.location.origin).href,
      );
      setNotice('Link copied.');
    } catch {
      linkInput.current?.select();
      setNotice('Select and copy the link above.');
    }
  }

  const fullLink = path ? new URL(path, window.location.origin).href : '';
  return (
    <section className="meeting-share-card" aria-label="Full meeting sharing">
      <div className="meeting-share-overview">
        <span className="meeting-share-icon">
          <Share2 size={17} />
        </span>
        <div>
          <strong>Share the full meeting</strong>
          <p>
            {privateMeeting
              ? 'Choose when to give someone access to this recording, transcript, and summaries.'
              : 'Send a read-only view of this public demo recording and its notes.'}
          </p>
        </div>
        <button
          type="button"
          className="meeting-share-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <Share2 size={14} /> {expanded ? 'Hide sharing' : 'Share meeting'}
        </button>
      </div>
      {expanded && (
        <div className="meeting-share-details">
          {status === 'loading' ? (
            <p role="status">
              <LoaderCircle size={15} className="loading-icon" /> Checking link
              status…
            </p>
          ) : status === 'error' ? (
            <p role="alert">
              Sharing status couldn’t load.
              <button
                type="button"
                onClick={() => {
                  setStatus('loading');
                  setAttempt((value) => value + 1);
                }}
              >
                <RotateCcw size={13} /> Retry
              </button>
            </p>
          ) : path ? (
            <>
              <p>
                {privateMeeting
                  ? 'Anyone with this link can view the entire meeting. Revoke it at any time.'
                  : 'This recording is already public in the demo workspace.'}
              </p>
              <div className="meeting-share-link-row">
                <input
                  ref={linkInput}
                  readOnly
                  aria-label="Public meeting link"
                  value={fullLink}
                  onFocus={(event) => event.target.select()}
                />
                <button type="button" onClick={() => void copyLink()}>
                  <Copy size={14} /> Copy link
                </button>
                <a href={path} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> Open public view
                </a>
              </div>
              {privateMeeting && (
                <button
                  type="button"
                  className="meeting-share-revoke"
                  disabled={busy}
                  onClick={() => void changeShare('DELETE')}
                >
                  {busy ? (
                    <LoaderCircle size={13} className="loading-icon" />
                  ) : null}
                  Revoke public link
                </button>
              )}
            </>
          ) : (
            <div className="meeting-share-create">
              <p>
                Creating a link will make the full recording, transcript, and AI
                notes visible to anyone who has it.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void changeShare('POST')}
              >
                {busy ? (
                  <LoaderCircle size={14} className="loading-icon" />
                ) : (
                  <Check size={14} />
                )}
                {busy ? 'Creating link…' : 'Create public link'}
              </button>
            </div>
          )}
          {notice && (
            <p className="meeting-share-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
