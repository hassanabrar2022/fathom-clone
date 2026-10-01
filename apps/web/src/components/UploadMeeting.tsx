import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Clock3,
  FileAudio,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  uploadedMeetingSchema,
  processingMessages,
  type UploadedMeeting,
} from '../../../../packages/shared/ingestion';
import { formatTime } from '../../../../packages/shared/meeting';
import {
  createUpload,
  inspectMedia,
  transferRecording,
  transferStatus,
  uploadApi,
} from '../data/uploads';
import { RecordingExperience } from './RecordingMeeting';
import { MeetingShareControl } from './MeetingShareControl';
import { DeleteMeetingControl } from './DeleteMeetingControl';
import './upload.css';

export function UploadMeeting() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [duration, setDuration] = useState(0);
  const selection = useRef(0);
  async function choose(next: File | undefined) {
    if (!next || busy) return;
    const version = ++selection.current;
    setError('');
    setFile(null);
    setBusy(true);
    try {
      const metadata = await inspectMedia(next);
      if (version === selection.current) {
        setFile(next);
        setTitle(metadata.title);
        setDuration(metadata.duration);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The recording could not be read.',
      );
    } finally {
      if (version === selection.current) setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      await createUpload(file, title.trim(), (id) =>
        navigate(`/app/meetings/${id}`),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Upload could not start. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to="/app" className="back-link">
        <ArrowLeft size={16} /> All meetings
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">YOUR NEXT CONVERSATION</div>
          <h1>Upload a recording</h1>
          <p className="upload-intro">
            Turn a conversation into a transcript you can return to.
          </p>
        </div>
      </div>
      <div className="upload-layout">
        <form className="upload-card" onSubmit={(e) => void submit(e)}>
          <label
            className={`upload-drop ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void choose(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              aria-label="Recording file"
              accept=".mp4,.mov,.webm,.mp3,.wav,.m4a"
              disabled={busy}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
            <span className="upload-icon">
              {busy ? (
                <LoaderCircle className="loading-icon" size={28} />
              ) : file ? (
                <FileAudio size={28} />
              ) : (
                <Upload size={28} />
              )}
            </span>
            <strong>{file ? file.name : 'Drop your recording here'}</strong>
            <span>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${formatTime(duration)} · Click to change`
                : 'or click to choose a file'}
            </span>
            <small>
              MP4, MOV, WebM, MP3, WAV, M4A · Up to 25 MB / 10 minutes
            </small>
          </label>
          <label className="upload-title">
            Meeting title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              disabled={busy}
              placeholder="Give this conversation a name"
            />
          </label>
          <p className="upload-privacy">
            <LockKeyhole size={16} /> Your recording is private to your account
            until you choose to share it. It is stored in private storage and
            transcribed and summarized by Cloudflare Workers AI.
          </p>
          <p className="upload-consent">
            Upload only recordings you have permission to process.
          </p>
          {error && (
            <p className="upload-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={!file || !title.trim() || busy}
          >
            {busy ? (
              <LoaderCircle size={16} className="loading-icon" />
            ) : (
              <Upload size={16} />
            )}
            {busy ? 'Preparing recording…' : 'Upload & transcribe'}
          </button>
        </form>
        <aside className="upload-explainer">
          <span className="eyebrow">FROM AUDIO TO CLARITY</span>
          <h2>Find your way back to what mattered.</h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Upload once</strong>
                <p>Your recording goes directly to private storage.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Follow the conversation</strong>
                <p>
                  Real speech-to-text creates a transcript with playback
                  timestamps.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Review with context</strong>
                <p>
                  Read three summary views and trace action items to their
                  source.
                </p>
              </div>
            </li>
          </ol>
          <p className="upload-footnote">
            The transcript stays available if analysis needs a retry. Speaker
            identities are not inferred.
          </p>
        </aside>
      </div>
    </>
  );
}

const statusLabels: Record<UploadedMeeting['status'], string> = {
  uploading: 'Uploading',
  uploaded: 'Uploaded',
  transcribing: 'Transcribing',
  analyzing: 'Summarizing',
  complete: 'Ready',
  failed: 'Needs attention',
};

export function MeetingLibrary() {
  const [items, setItems] = useState<UploadedMeeting[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    uploadApi('uploads')
      .then((data) => {
        if (!disposed) {
          setItems(uploadedMeetingSchema.array().parse(data));
          setError(false);
        }
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
    };
  }, [attempt]);
  if (error)
    return (
      <div className="empty-state" role="alert">
        <h3>Meetings couldn’t load</h3>
        <p>Check your connection and try again.</p>
        <button
          className="secondary-button"
          onClick={() => {
            setError(false);
            setItems(null);
            setAttempt((value) => value + 1);
          }}
        >
          Retry meetings
        </button>
      </div>
    );
  if (!items)
    return (
      <div className="empty-state" role="status">
        <h3>Loading meetings…</h3>
        <div className="loading-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (!items.length)
    return (
      <div className="empty-state">
        <Upload size={30} />
        <h3>No meetings yet</h3>
        <p>
          Upload a recording to get a searchable transcript, summaries, and
          action items.
        </p>
        <Link className="primary-button" to="/app/upload">
          <Upload size={16} /> Upload your first recording
        </Link>
      </div>
    );
  return (
    <section className="uploaded-library" aria-label="Your meetings">
      <div className="library-heading">
        <h2>
          Your recordings <span>{items.length}</span>
        </h2>
      </div>
      {items.map((item) => (
        <Link
          className="uploaded-row"
          key={item.id}
          to={`/app/meetings/${item.id}`}
        >
          <span className="upload-row-icon">
            <AudioLines size={20} />
          </span>
          <div>
            <strong>{item.title}</strong>
            <p>
              {formatTime(item.duration_seconds)} ·{' '}
              {new Date(item.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <span className={`upload-status ${item.status}`}>
            {statusLabels[item.status]}
          </span>
          <ArrowRight size={16} />
        </Link>
      ))}
    </section>
  );
}

export function UploadedMeetingDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<UploadedMeeting | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [running, setRunning] = useState(false);
  const [transfer, setTransfer] = useState(() => transferStatus(id));
  const retryFile = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let disposed = false;
    let timer: number;
    async function load() {
      let poll = running;
      try {
        const data = uploadedMeetingSchema.parse(
          await uploadApi(`uploads/${id}`),
        );
        poll = poll || !['complete', 'failed'].includes(data.status);
        if (!disposed) {
          setMeeting(data);
          setError('');
          document.title = `${data.title} · Fathom Clone`;
        }
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error ? e.message : 'Unable to load this recording.',
          );
      }
      if (!disposed && poll) timer = window.setTimeout(() => void load(), 2500);
    }
    const changed = () => {
      setTransfer(transferStatus(id));
      clearTimeout(timer);
      void load();
    };
    window.addEventListener('fathom-clone-transfer', changed);
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('fathom-clone-transfer', changed);
    };
  }, [id, attempt, running]);
  async function process() {
    setRunning(true);
    setError('');
    try {
      setMeeting(
        uploadedMeetingSchema.parse(
          await uploadApi(`uploads/${id}/process`, 'POST'),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Processing interrupted. Retry to continue.',
      );
    } finally {
      setRunning(false);
    }
  }
  const feedback = meeting && (
    <>
      <span className="upload-icon">
        <Sparkles size={24} />
      </span>
      <h2>
        {meeting.status === 'failed'
          ? 'A step needs another try'
          : meeting.status === 'complete'
            ? 'No speech detected'
            : 'Preparing your conversation'}
      </h2>
      <p>
        {meeting.processing_error
          ? processingMessages[meeting.processing_error]
          : meeting.status === 'complete'
            ? 'No spoken content was detected. You can still play the recording.'
            : meeting.status === 'analyzing'
              ? 'Transcript saved. Creating summaries and finding supported action items…'
              : meeting.status === 'transcribing'
                ? 'Listening to your recording and adding timestamps…'
                : transfer?.confirmed
                  ? 'Upload confirmed. Starting transcription…'
                  : transfer?.progress === 100 && !transfer.error
                    ? 'Recording sent. Waiting for storage confirmation…'
                    : 'Keep this tab open while your recording uploads.'}
      </p>
      {meeting.status !== 'complete' && (
        <div className="ingestion-progress">
          <progress
            aria-label="Recording processing progress"
            max={100}
            value={
              meeting.status === 'uploading'
                ? (transfer?.progress ?? 0) * 0.3
                : meeting.processing_progress
            }
          />
          <span>
            {meeting.status === 'uploading'
              ? `Uploading ${transfer?.progress ?? 0}%`
              : meeting.status === 'failed'
                ? 'Progress saved'
                : `${meeting.processing_progress}% · ${meeting.status}`}
          </span>
        </div>
      )}
      {transfer?.error && (
        <p className="upload-error" role="alert">
          {transfer.error}
        </p>
      )}
      {(meeting.status === 'uploading' && !transfer) ||
      meeting.processing_error === 'upload_failed' ||
      (meeting.duration_seconds > 120 &&
        meeting.transcript === null &&
        (meeting.processing_error === 'transcription_failed' ||
          !!transfer?.error)) ||
      (transfer?.error && !transfer.confirmed) ? (
        <button
          className="secondary-button"
          onClick={() => retryFile.current?.click()}
        >
          <Upload size={15} /> Choose recording to retry
        </button>
      ) : (
        meeting.status !== 'complete' && (
          <button
            className="secondary-button"
            disabled={
              running ||
              (meeting.status === 'uploading' && !!transfer && !transfer.error)
            }
            onClick={() => void process()}
          >
            <RotateCcw size={15} />
            {running
              ? 'Processing…'
              : meeting.status === 'failed'
                ? 'Retry processing'
                : 'Check / resume processing'}
          </button>
        )
      )}
    </>
  );
  const search = new URLSearchParams(window.location.search);
  const seek = search.has('t') ? Number(search.get('t')) : undefined;
  return (
    <>
      <Link to="/app" className="back-link">
        <ArrowLeft size={16} /> All meetings
      </Link>
      {error && (
        <div className="upload-error" role="alert">
          {error}{' '}
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry meeting
          </button>
        </div>
      )}
      {!meeting ? (
        !error && (
          <section className="recording-load-state" role="status">
            <LoaderCircle size={28} className="loading-icon" />
            <h2>Loading your recording</h2>
            <div className="loading-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        )
      ) : (
        <>
          <div className="detail-heading recording-heading">
            <div>
              <div className="eyebrow">YOUR RECORDING</div>
              <h1>{meeting.title}</h1>
              <div className="detail-meta">
                <span>
                  <Clock3 size={15} />
                  {formatTime(meeting.duration_seconds)}
                </span>
                <span>
                  <LockKeyhole size={15} />
                  Private by default
                </span>
                {meeting.status === 'complete' && (
                  <span>
                    <CheckCircle2 size={15} />
                    Ready
                  </span>
                )}
              </div>
            </div>
            <DeleteMeetingControl
              meetingId={meeting.id}
              meetingTitle={meeting.title}
              disabled={
                running ||
                (!!transfer && !transfer.error && !transfer.confirmed)
              }
              onDeleted={() => navigate('/app', { replace: true })}
            />
          </div>
          {meeting.status === 'complete' && (
            <MeetingShareControl meetingId={meeting.id} />
          )}
          <input
            hidden
            ref={retryFile}
            type="file"
            accept=".mp4,.mov,.webm,.mp3,.wav,.m4a"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void transferRecording(file, meeting);
            }}
          />
          {meeting.transcript === null ? (
            <section className="upload-processing" aria-live="polite">
              {feedback}
            </section>
          ) : (
            <RecordingExperience
              key={`${id}-${seek ?? 'start'}`}
              initialSeek={
                seek !== undefined && Number.isFinite(seek) ? seek : undefined
              }
              searchQuery={search.get('q') ?? undefined}
              recording={{
                id,
                mediaUrl: `/api/uploads/${id}/media`,
                duration: meeting.duration_seconds,
                speakers: [
                  {
                    id: 'speaker',
                    name: meeting.speaker_names.speaker || 'Speaker',
                  },
                ],
                segments: meeting.transcript,
                intelligence: meeting.intelligence,
              }}
              meetingTitle={meeting.title}
              analysisFeedback={feedback}
              onRenameSpeaker={async (speakerId, name) => {
                const saved = uploadedMeetingSchema.parse(
                  await uploadApi(`uploads/${id}/speakers`, 'PATCH', {
                    speakerId,
                    name,
                  }),
                );
                setMeeting(saved);
              }}
            />
          )}
        </>
      )}
    </>
  );
}
