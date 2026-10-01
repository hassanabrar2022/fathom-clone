import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AudioLines,
  FileText,
  LoaderCircle,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { formatTime } from '../../../../packages/shared/meeting';
import {
  activeSegment,
  boundedTime,
} from '../../../../packages/shared/recording';
import {
  privateShareTokenSchema,
  sharedMeetingSchema,
  type SharedMeeting as SharedMeetingData,
} from '../../../../packages/shared/sharing';
import { MeetingIntelligence } from './MeetingIntelligence';
import './shared-meeting.css';

export function SharedMeeting() {
  const { token } = useParams();
  const privateToken = token?.startsWith('meeting-') ? token.slice(8) : '';
  const invalid = !privateShareTokenSchema.safeParse(privateToken).success;
  const [meeting, setMeeting] = useState<SharedMeetingData | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'missing' | 'error'
  >('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Shared meeting · Fathom Clone';
  }, []);

  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let disposed = false;
    async function load() {
      try {
        const response = await fetch(`/api/shares/${privateToken}`, {
          credentials: 'omit',
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (!disposed) setStatus('missing');
          return;
        }
        if (!response.ok) throw new Error('Shared meeting unavailable');
        const result = sharedMeetingSchema.parse(await response.json());
        if (!disposed) {
          setMeeting(result);
          setStatus('ready');
        }
      } catch {
        if (!disposed) setStatus('error');
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [privateToken, invalid, attempt]);

  return (
    <div className="share-page">
      <header className="share-topbar">
        <div className="share-brand" aria-label="Fathom Clone">
          <span>
            <AudioLines size={19} />
          </span>
          fathom <small>clone</small>
        </div>
        <span className="share-provenance">
          <Share2 size={14} /> Shared via Fathom Clone
        </span>
      </header>
      <main className="share-main">
        {invalid || status === 'missing' ? (
          <section className="share-state">
            <Share2 size={30} />
            <h1>This shared meeting isn’t available</h1>
            <p>
              The link may be invalid or its owner may have revoked access. Ask
              the sender for a new link.
            </p>
          </section>
        ) : status === 'loading' ? (
          <section className="share-state" role="status">
            <LoaderCircle size={28} className="loading-icon" />
            <h1>Opening this meeting</h1>
            <p>Loading the recording, transcript, and meeting notes…</p>
            <div className="loading-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        ) : status === 'error' || !meeting ? (
          <section className="share-state" role="alert">
            <FileText size={30} />
            <h1>This meeting couldn’t load</h1>
            <p>
              Check your connection and try opening the shared meeting again.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setStatus('loading');
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw size={16} /> Try again
            </button>
          </section>
        ) : (
          <SharedMeetingExperience meeting={meeting} />
        )}
      </main>
      <footer className="share-footer">
        A read-only view of the conversation · FATHOM CLONE
      </footer>
    </div>
  );
}

function SharedMeetingExperience({ meeting }: { meeting: SharedMeetingData }) {
  const media = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const active = activeSegment(meeting.segments, time);

  function seek(timestamp: number) {
    const next = boundedTime(timestamp, meeting.duration);
    if (media.current?.readyState) media.current.currentTime = next;
    else pendingSeek.current = next;
    setTime(next);
  }

  return (
    <article className="share-card">
      <div className="share-intro full-share-intro">
        <span className="small-label">FULL MEETING · READ-ONLY</span>
        <h1>{meeting.title}</h1>
        <p>{meeting.description}</p>
        <span className="full-share-duration">
          Recording · {formatTime(meeting.duration)}
        </span>
      </div>
      <div className="full-share-grid">
        <div className="full-share-main">
          <section
            className="share-player-card"
            aria-label="Shared meeting recording"
          >
            <div className="share-player-frame">
              <video
                key={mediaAttempt}
                ref={media}
                controls
                playsInline
                preload="metadata"
                poster={meeting.posterUrl}
                src={meeting.mediaUrl}
                aria-label={`Shared recording of ${meeting.title}`}
                onLoadedMetadata={() => {
                  if (pendingSeek.current !== null && media.current) {
                    media.current.currentTime = boundedTime(
                      pendingSeek.current,
                      media.current.duration,
                    );
                    pendingSeek.current = null;
                  }
                  setMediaState('ready');
                }}
                onCanPlay={() => setMediaState('ready')}
                onWaiting={() => setMediaState('loading')}
                onPlaying={() => setMediaState('ready')}
                onTimeUpdate={() => setTime(media.current?.currentTime ?? 0)}
                onError={() => setMediaState('error')}
              />
              {mediaState === 'loading' && (
                <div className="share-media-overlay" role="status">
                  <LoaderCircle size={24} className="loading-icon" /> Loading
                  recording…
                </div>
              )}
              {mediaState === 'error' && (
                <div className="share-media-overlay" role="alert">
                  <FileText size={26} />
                  <strong>Recording couldn’t load</strong>
                  <span>The transcript and notes are still available.</span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setMediaState('loading');
                      setMediaAttempt((value) => value + 1);
                    }}
                  >
                    <RotateCcw size={15} /> Retry recording
                  </button>
                </div>
              )}
            </div>
            <div className="share-player-status">
              <span>
                {formatTime(time)} <i>/ {formatTime(meeting.duration)}</i>
              </span>
              <span>Use a transcript timestamp to jump to its source.</span>
            </div>
          </section>
          <section
            className="transcript-panel full-share-transcript"
            aria-labelledby="shared-transcript-title"
          >
            <div className="transcript-header">
              <div>
                <h2 id="shared-transcript-title">
                  Transcript <span>{meeting.segments.length} turns</span>
                </h2>
                <p>Every timestamp opens that point in the shared recording.</p>
              </div>
            </div>
            {meeting.segments.length ? (
              <div className="transcript-scroll">
                {meeting.segments.map((segment) => {
                  const speaker =
                    meeting.speakers.find(
                      (item) => item.id === segment.speakerId,
                    )?.name ?? 'Speaker';
                  return (
                    <article
                      key={segment.id}
                      className={`transcript-turn ${active === segment.id ? 'is-active' : ''}`}
                    >
                      <div className="turn-heading">
                        <span className="speaker-dot" />
                        <strong>{speaker}</strong>
                        <button
                          type="button"
                          className="timestamp-button"
                          onClick={() => seek(segment.start)}
                          disabled={mediaState === 'error'}
                          aria-label={`Seek to ${formatTime(segment.start)} from ${speaker}`}
                        >
                          {formatTime(segment.start)}
                        </button>
                      </div>
                      <div className="turn-text">
                        {segment.paragraphs.map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="share-context-empty">
                <FileText size={20} />
                <p>No spoken transcript is available for this recording.</p>
              </div>
            )}
          </section>
        </div>
        {meeting.intelligence ? (
          <MeetingIntelligence
            meetingTitle={meeting.title}
            intelligence={meeting.intelligence}
            onSeek={seek}
            seekDisabled={mediaState === 'error'}
          />
        ) : (
          <aside className="full-share-no-analysis">
            <span className="small-label">MEETING NOTES</span>
            <h2>No AI notes available</h2>
            <p>
              This shared recording has no completed AI summary. You can still
              play the media and read its transcript.
            </p>
          </aside>
        )}
      </div>
    </article>
  );
}
