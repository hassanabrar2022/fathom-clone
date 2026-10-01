import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ExternalLink,
  Highlighter,
  LoaderCircle,
  Mic,
  MicOff,
  MonitorUp,
  Square,
} from 'lucide-react';
import { formatTime } from '../../../../packages/shared/meeting';
import {
  platformLabels,
  type Notetaker,
} from '../../../../packages/shared/notetaker';
import {
  addHighlight,
  cancelNotetaker,
  useNotetaker,
  useNow,
} from '../data/notetakers';
import { BrowserCapture, captureSupported, type CaptureState } from '../data/capture';
import { NotetakerStatus } from './RecordMeeting';
import './notetaker.css';

const botSteps: [Notetaker['status'][], string][] = [
  [['scheduled'], 'Scheduled'],
  [['joining', 'waiting_room'], 'Joining'],
  [['recording'], 'Recording'],
  [['processing'], 'Processing'],
  [['complete'], 'Ready'],
];

function Highlights({ notetaker }: { notetaker: Notetaker }) {
  const started = Date.parse(notetaker.recordingStartedAt ?? '');
  if (!notetaker.highlights.length) return null;
  return (
    <section className="live-highlights" aria-labelledby="highlights-title">
      <h2 id="highlights-title">Highlights</h2>
      <ol>
        {notetaker.highlights.map((highlight) => (
          <li key={highlight.id}>
            <span className="timestamp">
              {Number.isFinite(started)
                ? formatTime((Date.parse(highlight.at) - started) / 1000)
                : '—'}
            </span>
            <span>{highlight.note || 'Highlight'}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">
        Each highlight becomes a saved clip of the half minute before you
        clicked, ready to share once the notes are written.
      </p>
    </section>
  );
}

function HighlightControl({
  notetaker,
  onSaved,
}: {
  notetaker: Notetaker;
  onSaved: (value: Notetaker) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onSaved(await addHighlight(notetaker.id, note.trim()));
      setNote('');
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The highlight was not saved.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="highlight-control"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        value={note}
        maxLength={100}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What just happened? (optional)"
        aria-label="Highlight note"
      />
      <button className="primary-button highlight-button" type="submit" disabled={busy}>
        {flash ? <Check size={17} /> : <Highlighter size={17} />}
        {flash ? 'Highlighted' : 'Highlight'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function BrowserRecorder({
  notetaker,
  onChanged,
  onPhase,
}: {
  notetaker: Notetaker;
  onChanged: () => void;
  onPhase: (phase: CaptureState['phase']) => void;
}) {
  const navigate = useNavigate();
  const capture = useRef<BrowserCapture | null>(null);
  const [state, setState] = useState<CaptureState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (state?.phase !== 'recording') return;
    const timer = window.setInterval(
      () => setElapsed(capture.current?.elapsed() ?? 0),
      1000,
    );
    return () => clearInterval(timer);
  }, [state?.phase]);
  useEffect(() => {
    const instance = new BrowserCapture(
      notetaker.id,
      (next) => setState({ ...next }),
      () => void instance.stop().then((id) => navigate(`/app/meetings/${id}`)).catch(() => {}),
    );
    capture.current = instance;
    return () => instance.discard();
  }, [notetaker.id, navigate]);
  useEffect(() => {
    if (state?.phase !== 'recording' && state?.phase !== 'saving') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state?.phase]);
  useEffect(() => {
    if (state?.phase === 'recording') onChanged();
    onPhase(state?.phase ?? 'idle');
  }, [state?.phase, onChanged, onPhase]);

  if (!captureSupported())
    return (
      <p className="form-error" role="alert">
        Recording from the browser needs desktop Chrome or Edge.
      </p>
    );
  const phase = state?.phase ?? 'idle';
  // Saved from another tab or an earlier visit: nothing left to record here.
  if (notetaker.meetingId && (phase === 'idle' || phase === 'error')) return null;
  if (phase === 'idle' || phase === 'starting' || phase === 'error')
    return (
      <div className="browser-start">
        <ol className="capture-steps">
          <li>
            {notetaker.meetingUrl ? (
              <a href={notetaker.meetingUrl} target="_blank" rel="noreferrer">
                Open the meeting <ExternalLink size={13} />
              </a>
            ) : (
              'Open your meeting'
            )}{' '}
            in another tab of this browser and join the call.
          </li>
          <li>
            Come back here and press <strong>Start recording</strong>. Choose
            the meeting’s tab and keep <strong>Share tab audio</strong> on.
          </li>
          <li>Keep this tab open until the call ends, then press Stop.</li>
        </ol>
        {state?.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={phase === 'starting'}
          onClick={() => void capture.current?.start()}
        >
          {phase === 'starting' ? <LoaderCircle className="spin" size={16} /> : <MonitorUp size={16} />}
          Start recording
        </button>
      </div>
    );
  if (phase === 'recording')
    return (
      <div className="browser-recording">
        <div className="recording-meta">
          <span className="live-timer" aria-live="off">
            <span className="live-dot" aria-hidden="true" />
            {formatTime(elapsed)}
          </span>
          <span className="muted small">
            {state?.microphone ? <Mic size={13} /> : <MicOff size={13} />}{' '}
            {state?.microphone ? 'Meeting tab + your microphone' : 'Meeting tab only (microphone blocked)'}
            {' · '}
            {state?.partsUploaded ?? 0} part{state?.partsUploaded === 1 ? '' : 's'} saved
          </span>
        </div>
        <button
          className="secondary-button danger"
          type="button"
          onClick={() =>
            void capture.current
              ?.stop()
              .then((id) => navigate(`/app/meetings/${id}`))
              .catch(() => {})
          }
        >
          <Square size={14} /> Stop and save
        </button>
      </div>
    );
  return (
    <div className="browser-saving" role="status">
      <LoaderCircle className="spin" size={18} />
      {phase === 'done'
        ? 'Saved. Opening your meeting…'
        : (state?.partsPending ?? 0) > 0
          ? 'Saving the last minutes of audio…'
          : `Uploading the recording… ${state?.saveProgress ?? 0}%`}
      <progress max={100} value={state?.saveProgress ?? 0} />
    </div>
  );
}

export function LiveMeeting({ id }: { id: string }) {
  const navigate = useNavigate();
  const { notetaker, setNotetaker, error, refresh, skew } = useNotetaker(id);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState('');
  const [capturePhase, setCapturePhase] = useState<CaptureState['phase']>('idle');
  const recording = notetaker?.status === 'recording';
  const now = useNow(1000, recording && notetaker?.provider === 'recall');
  useEffect(() => {
    if (notetaker) document.title = `${notetaker.title} · Live · Fathom Clone`;
  }, [notetaker]);

  if (error && !notetaker)
    return (
      <div className="empty-state" role="alert">
        <h1>This call could not load</h1>
        <p>{error}</p>
        <Link className="secondary-button" to="/app/record">
          Back to recording
        </Link>
      </div>
    );
  if (!notetaker)
    return (
      <div className="empty-state" role="status">
        <h3>Loading the call…</h3>
      </div>
    );

  const started = Date.parse(notetaker.recordingStartedAt ?? '');
  const elapsed = Number.isFinite(started) ? (now + skew - started) / 1000 : 0;
  const active = ['scheduled', 'joining', 'waiting_room', 'recording'].includes(notetaker.status);
  const bot = notetaker.provider === 'recall';
  const stepIndex = botSteps.findIndex(([statuses]) => statuses.includes(notetaker.status));

  async function stop() {
    setStopping(true);
    setStopError('');
    try {
      setNotetaker(await cancelNotetaker(notetaker!.id));
    } catch (e) {
      setStopError(e instanceof Error ? e.message : 'The notetaker could not be stopped.');
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="live-page">
      <Link className="back-link" to="/app/record">
        <ArrowLeft size={15} /> Record
      </Link>
      <header className="live-header">
        <div>
          <div className="eyebrow">
            {bot ? <Bot size={13} /> : <MonitorUp size={13} />}{' '}
            {bot ? 'NOTETAKER BOT' : 'RECORDING FROM THIS BROWSER'} ·{' '}
            {platformLabels[notetaker.platform].toUpperCase()}
          </div>
          <h1>{notetaker.title}</h1>
          <p className="muted">
            {notetaker.statusDetail ??
              (notetaker.status === 'scheduled' && bot
                ? `Joins at ${new Date(notetaker.joinAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
                : '')}
          </p>
        </div>
        <div className="live-header-actions">
          <NotetakerStatus notetaker={notetaker} />
          {notetaker.meetingUrl && (
            <a className="secondary-button small" href={notetaker.meetingUrl} target="_blank" rel="noreferrer">
              Open meeting <ExternalLink size={14} />
            </a>
          )}
        </div>
      </header>

      {bot && (
        <ol className="live-steps" aria-label="Notetaker progress">
          {botSteps.map(([, label], index) => (
            <li
              key={label}
              className={
                notetaker.status === 'failed' || notetaker.status === 'cancelled'
                  ? ''
                  : index < stepIndex
                    ? 'done'
                    : index === stepIndex
                      ? 'current'
                      : ''
              }
            >
              {label}
            </li>
          ))}
        </ol>
      )}

      {bot && notetaker.status === 'waiting_room' && (
        <p className="live-callout">
          The notetaker is waiting to be let in. Admit <strong>Fathom Clone Notetaker</strong> from the meeting.
        </p>
      )}

      {bot && recording && (
        <div className="live-timer large" aria-live="off">
          <span className="live-dot" aria-hidden="true" />
          {formatTime(elapsed)}
        </div>
      )}

      {!bot && notetaker.status !== 'cancelled' && (
        <BrowserRecorder notetaker={notetaker} onChanged={refresh} onPhase={setCapturePhase} />
      )}

      {recording && <HighlightControl notetaker={notetaker} onSaved={setNotetaker} />}

      <Highlights notetaker={notetaker} />

      {notetaker.meetingId && (bot || capturePhase === 'idle' || capturePhase === 'error') && (
        <div className="live-done">
          <p>
            {notetaker.status === 'complete'
              ? 'The recording is saved. Notes are being written; the transcript is searchable as soon as it lands.'
              : 'The recording is being imported.'}
          </p>
          <button className="primary-button" type="button" onClick={() => navigate(`/app/meetings/${notetaker.meetingId}`)}>
            Open meeting <ArrowRight size={16} />
          </button>
        </div>
      )}

      {notetaker.status === 'failed' && (
        <p className="form-error" role="alert">
          {notetaker.statusDetail ?? 'This call was not recorded.'}
        </p>
      )}

      {bot && active && (
        <div className="live-footer">
          {stopError && (
            <p className="form-error" role="alert">
              {stopError}
            </p>
          )}
          <button className="text-button danger" type="button" disabled={stopping} onClick={() => void stop()}>
            {recording ? 'Stop recording and leave the call' : 'Cancel notetaker'}
          </button>
        </div>
      )}
    </div>
  );
}
