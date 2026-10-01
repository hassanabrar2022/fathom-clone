import { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Copy,
  ExternalLink,
  Link2,
  Link2Off,
  Play,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { formatTime } from '../../../../packages/shared/meeting';
import {
  meetingMomentSchema,
  persistedMomentSchema,
  type PersistedMoment,
  type MeetingMoment,
} from '../../../../packages/shared/recording';
import { scrollBehavior } from '../motion';
import { uploadApi } from '../data/uploads';
import { useApiData } from '../data/meetings';
const momentsSchema = persistedMomentSchema.array();

export type MomentDraft = {
  requestId: number;
  start: number;
  end: number;
};

export function MeetingMoments({
  meetingId,
  duration,
  draft,
  onCloseDraft,
  onSeek,
  seekDisabled,
}: {
  meetingId: string;
  duration: number;
  draft: MomentDraft | null;
  onCloseDraft: () => void;
  onSeek: (time: number) => void;
  seekDisabled: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const base = `uploads/${meetingId}/moments`;
  const stored = useApiData(`/api/${base}`, momentsSchema);
  // Local edits layered over the loaded list; null marks a deleted moment.
  const [changes, setChanges] = useState<Map<string, PersistedMoment | null>>(
    () => new Map(),
  );
  const loaded = new Map((stored.data ?? []).map((m) => [m.id, m]));
  for (const [id, moment] of changes)
    if (moment) loaded.set(id, moment);
    else loaded.delete(id);
  const moments = [...loaded.values()].sort((a, b) => a.startMs - b.startMs);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    window.requestAnimationFrame(() =>
      panel.current?.scrollIntoView({
        behavior: scrollBehavior(),
        block: 'center',
      }),
    );
  }, [draft]);

  function remember(id: string, moment: PersistedMoment | null) {
    setChanges((current) => new Map(current).set(id, moment));
  }

  async function saveMoment(moment: MeetingMoment) {
    const result = persistedMomentSchema.parse(
      await uploadApi(base, 'POST', moment),
    );
    remember(result.id, result);
    setNotice('Moment saved. It stays private until you share it.');
    onCloseDraft();
  }

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setNotice('');
    try {
      await action();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'That didn’t work. Retry.',
      );
    } finally {
      setBusy(null);
    }
  }

  const share = (moment: PersistedMoment, method: 'POST' | 'DELETE') =>
    run(moment.id, async () => {
      const result = persistedMomentSchema.parse(
        await uploadApi(`${base}/${moment.id}/share`, method),
      );
      remember(result.id, result);
      if (method === 'POST' && result.sharePath) {
        await copyLink(result.sharePath);
      } else setNotice('Public link revoked. It no longer opens this moment.');
    });

  const remove = (moment: PersistedMoment) =>
    run(moment.id, async () => {
      await uploadApi(`${base}/${moment.id}`, 'DELETE');
      remember(moment.id, null);
      setNotice('Moment deleted.');
    });

  async function copyLink(sharePath: string) {
    const url = new URL(sharePath, window.location.origin);
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice('Public link copied. Anyone with it can view this moment.');
    } catch {
      setNotice(`Public link: ${url}`);
    }
  }

  return (
    <section className="moments-card" id="meeting-moments" ref={panel}>
      <div className="moments-heading">
        <span className="moments-mark">
          <BookmarkPlus size={18} />
        </span>
        <div>
          <h2>
            Moments <span>{moments.length}</span>
          </h2>
          <p>Save the part worth returning to or sharing.</p>
        </div>
      </div>

      {draft && (
        <MomentComposer
          key={draft.requestId}
          meetingId={meetingId}
          duration={duration}
          draft={draft}
          onCancel={onCloseDraft}
          onSave={saveMoment}
        />
      )}

      {stored.loading && <p role="status">Loading saved moments…</p>}
      {stored.error && (
        <p role="alert">
          Saved moments couldn’t load.{' '}
          <button className="secondary-button" onClick={stored.retry}>
            Retry moments
          </button>
        </p>
      )}
      <div className="moment-list" aria-label="Saved moments">
        {stored.loading || stored.error ? null : moments.length === 0 ? (
          <div className="moment-empty">
            <Share2 size={20} />
            <p>Use a transcript row or the player to save the first moment.</p>
          </div>
        ) : (
          moments.map((moment) => (
            <article className="moment-item" key={moment.id}>
              <button
                className="moment-play"
                aria-label={`Play ${moment.title} at ${formatTime(moment.startMs / 1000)}`}
                disabled={seekDisabled}
                onClick={() => onSeek(moment.startMs / 1000)}
              >
                <Play size={14} />
              </button>
              <div className="moment-copy">
                <h3>{moment.title}</h3>
                {moment.note && <p>{moment.note}</p>}
                <span>
                  {formatTime(moment.startMs / 1000)}–
                  {formatTime(Math.ceil(moment.endMs / 1000))} ·{' '}
                  {moment.sharePath ? 'Shared by link' : 'Private'}
                </span>
              </div>
              <div className="moment-actions">
                {moment.sharePath ? (
                  <>
                    <button
                      className="moment-action"
                      disabled={busy === moment.id}
                      onClick={() => void copyLink(moment.sharePath!)}
                      aria-label={`Copy public link for ${moment.title}`}
                    >
                      <Copy size={14} /> Copy link
                    </button>
                    <a
                      className="moment-action"
                      href={moment.sharePath}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open public view for ${moment.title}`}
                    >
                      <ExternalLink size={14} /> Open
                    </a>
                    <button
                      className="moment-action"
                      disabled={busy === moment.id}
                      onClick={() => void share(moment, 'DELETE')}
                      aria-label={`Revoke public link for ${moment.title}`}
                    >
                      <Link2Off size={14} /> Revoke
                    </button>
                  </>
                ) : (
                  <button
                    className="moment-action"
                    disabled={busy === moment.id}
                    onClick={() => void share(moment, 'POST')}
                    aria-label={`Create public link for ${moment.title}`}
                  >
                    <Link2 size={14} /> Share
                  </button>
                )}
                <button
                  className="moment-action"
                  disabled={busy === moment.id}
                  onClick={() => void remove(moment)}
                  aria-label={`Delete ${moment.title}`}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {notice && (
        <p className="moment-save-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

function MomentComposer({
  meetingId,
  duration,
  draft,
  onCancel,
  onSave,
}: {
  meetingId: string;
  duration: number;
  draft: MomentDraft;
  onCancel: () => void;
  onSave: (moment: MeetingMoment) => Promise<void>;
}) {
  const [title, setTitle] = useState(`Moment at ${formatTime(draft.start)}`);
  const [note, setNote] = useState('');
  const [start, setStart] = useState(String(Number(draft.start.toFixed(3))));
  const [end, setEnd] = useState(String(Number(draft.end.toFixed(3))));
  const [formError, setFormError] = useState('');
  const [momentId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const startSeconds = Number(start);
    const endSeconds = Number(end);
    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      startSeconds < 0 ||
      endSeconds <= startSeconds ||
      endSeconds > duration ||
      endSeconds - startSeconds > 60
    ) {
      setFormError(
        `Choose a range up to 60 seconds between 0:00 and ${formatTime(duration)}.`,
      );
      return;
    }
    const parsed = meetingMomentSchema.safeParse({
      id: momentId,
      meetingId,
      startMs: Math.round(startSeconds * 1000),
      endMs: Math.round(endSeconds * 1000),
      title: title.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      setFormError('Add a short title before saving this moment.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await onSave(parsed.data);
    } catch {
      setFormError('Moment could not be saved. Please retry.');
      setSaving(false);
    }
  }

  return (
    <form className="moment-composer" onSubmit={submit} noValidate>
      <div className="moment-composer-heading">
        <div>
          <span className="small-label">NEW MOMENT</span>
          <h3>Capture this part of the conversation</h3>
        </div>
        <button
          type="button"
          className="moment-close"
          onClick={onCancel}
          aria-label="Cancel moment"
        >
          <X size={17} />
        </button>
      </div>
      <label className="moment-title-field">
        Title
        <input
          value={title}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
        />
      </label>
      <label className="moment-note-field">
        Note <span>optional</span>
        <textarea
          value={note}
          maxLength={280}
          rows={2}
          placeholder="Why will this matter later?"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="moment-range-fields">
        <label>
          Start (seconds)
          <input
            type="number"
            min="0"
            max={duration}
            step="0.001"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <span aria-hidden="true">→</span>
        <label>
          End (seconds)
          <input
            type="number"
            min="0.001"
            max={duration}
            step="0.001"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <span className="moment-range-preview">
          {formatTime(Number(start) || 0)}–
          {formatTime(Math.ceil(Number(end) || 0))}
        </span>
      </div>
      {formError && (
        <p className="moment-form-error" role="alert">
          {formError}
        </p>
      )}
      <p className="moment-share-hint">
        Moments are private. If you share one later, anyone with its link can
        view this title, note, and the recording around it.
      </p>
      <div className="moment-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <BookmarkPlus size={15} /> {saving ? 'Saving…' : 'Save moment'}
        </button>
      </div>
    </form>
  );
}
