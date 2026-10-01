import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AudioLines,
  Clock3,
  FileText,
  LoaderCircle,
  Play,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { formatTime } from '../../../../packages/shared/meeting';
import {
  persistedMomentSchema,
  type MeetingMoment,
} from '../../../../packages/shared/recording';
import {
  sharedMeetingSchema,
  type SharedMeeting,
} from '../../../../packages/shared/sharing';
import { z } from 'zod';
import { useApiData } from '../data/meetings';
const sharedMomentDataSchema = z.object({
  recording: sharedMeetingSchema,
  moment: persistedMomentSchema,
});
import './shared-moment.css';

export function SharedMoment() {
  const { token } = useParams();
  const valid = !!token && /^moment-[a-f0-9]{64}$/.test(token);
  const loaded = useApiData(
    valid ? `/api/moments/${token!.slice(7)}` : undefined,
    sharedMomentDataSchema,
  );
  const recording = loaded.data?.recording;
  const moment = loaded.data?.moment;
  const error = loaded.error;
  useEffect(() => {
    document.title = 'Shared moment · Fathom Clone';
  }, []);

  return (
    <div className="share-page">
      <header className="share-topbar">
        <Link className="share-brand" to="/" aria-label="Fathom Clone home">
          <span>
            <AudioLines size={19} />
          </span>
          fathom <small>clone</small>
        </Link>
        <span className="share-provenance">
          <Share2 size={14} /> Shared via Fathom Clone
        </span>
      </header>
      <main className="share-main">
        {!valid || loaded.missing ? (
          <InvalidShare />
        ) : error ? (
          <section className="share-state" role="alert">
            <FileText size={30} />
            <h1>This moment couldn’t load</h1>
            <p>The link may be unavailable. Check your connection and retry.</p>
            <button
              className="primary-button"
              onClick={() => {
                loaded.retry();
              }}
            >
              <RotateCcw size={16} /> Try again
            </button>
          </section>
        ) : !recording ? (
          <section className="share-state" role="status">
            <LoaderCircle className="loading-icon" size={28} />
            <h1>Opening this moment</h1>
            <p>Loading the recording and transcript context…</p>
            <div className="loading-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        ) : !moment ? (
          <InvalidShare />
        ) : (
          <SharedMomentExperience
            meetingTitle={recording.title}
            meetingSummary={recording.description}
            recording={recording}
            moment={moment}
          />
        )}
      </main>
      <footer className="share-footer">
        A focused view of the conversation · FATHOM CLONE
      </footer>
    </div>
  );
}

function InvalidShare() {
  return (
    <section className="share-state">
      <Share2 size={30} />
      <h1>This shared moment isn’t available</h1>
      <p>The link may be incomplete or its time range is no longer valid.</p>
      <Link className="primary-button" to="/">
        <ArrowLeft size={16} /> Explore Fathom Clone
      </Link>
    </section>
  );
}

function SharedMomentExperience({
  meetingTitle,
  meetingSummary,
  recording,
  moment,
}: {
  meetingTitle: string;
  meetingSummary: string;
  recording: SharedMeeting;
  moment: MeetingMoment;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const start = moment.startMs / 1000;
  const end = moment.endMs / 1000;
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [currentTime, setCurrentTime] = useState(start);
  const [clipEnded, setClipEnded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const context = recording.segments.filter(
    (segment) => segment.end > start && segment.start < end,
  );

  function resetAtStart(play = false) {
    const element = video.current;
    if (!element || element.readyState < 1) return;
    element.currentTime = start;
    setCurrentTime(start);
    setClipEnded(false);
    if (play) void element.play();
  }

  return (
    <article className="share-card">
      <div className="share-intro">
        <div className="eyebrow">MOMENT FROM THIS MEETING</div>
        <h1>{moment.title}</h1>
        {moment.note && <p className="share-note">{moment.note}</p>}
        <div className="share-range">
          <Clock3 size={15} />
          {formatTime(start)}–{formatTime(Math.ceil(end))}
          <span>{Math.ceil(end - start)} second excerpt</span>
        </div>
      </div>

      <div className="share-content-grid">
        <section
          className="share-player-card"
          aria-label="Shared recording moment"
        >
          <div className="share-player-frame">
            <video
              key={mediaAttempt}
              ref={video}
              controls
              playsInline
              preload="metadata"
              src={recording.mediaUrl}
              aria-label={`Shared moment from ${meetingTitle}`}
              onLoadedMetadata={() => {
                resetAtStart();
                setMediaState('ready');
              }}
              onCanPlay={() => setMediaState('ready')}
              onPlay={() => {
                const time = video.current?.currentTime ?? start;
                if (time < start || time >= end) resetAtStart();
                setPlaying(true);
              }}
              onPause={() => setPlaying(false)}
              onSeeking={() => setMediaState('loading')}
              onSeeked={() => setMediaState('ready')}
              onWaiting={() => setMediaState('loading')}
              onPlaying={() => setMediaState('ready')}
              onTimeUpdate={() => {
                const element = video.current;
                if (!element) return;
                if (element.currentTime < start) {
                  element.currentTime = start;
                  return;
                }
                if (element.currentTime >= end) {
                  element.pause();
                  element.currentTime = end;
                  setCurrentTime(end);
                  setClipEnded(true);
                  return;
                }
                setCurrentTime(element.currentTime);
              }}
              onError={() => setMediaState('error')}
            />
            {mediaState === 'loading' && (
              <div className="share-media-overlay" role="status">
                <LoaderCircle className="loading-icon" size={24} />
                Loading moment…
              </div>
            )}
            {mediaState === 'error' && (
              <div className="share-media-overlay" role="alert">
                <FileText size={26} />
                <strong>Recording couldn’t load</strong>
                <span>The transcript context is still available.</span>
                <button
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
              {formatTime(currentTime)} <i>/ {formatTime(Math.ceil(end))}</i>
            </span>
            {clipEnded ? (
              <button onClick={() => resetAtStart(true)}>
                <RotateCcw size={14} /> Replay moment
              </button>
            ) : !playing ? (
              <button onClick={() => resetAtStart(true)}>
                <Play size={14} /> Play moment
              </button>
            ) : (
              <span className="share-bounded-label">
                Playback pauses at {formatTime(Math.ceil(end))}
              </span>
            )}
          </div>
        </section>

        <aside
          className="share-context-card"
          aria-labelledby="share-context-title"
        >
          <span className="small-label">TRANSCRIPT CONTEXT</span>
          <h2 id="share-context-title">Hear it in the conversation</h2>
          {context.length === 0 ? (
            <div className="share-context-empty">
              <FileText size={20} />
              <p>
                No transcript is available for this moment. The recording
                remains playable.
              </p>
            </div>
          ) : (
            <div className="share-transcript">
              {context.map((segment) => {
                const speaker = recording.speakers.find(
                  (item) => item.id === segment.speakerId,
                );
                return (
                  <section key={segment.id}>
                    <div>
                      <span
                        className={`speaker-dot ${segment.speakerId === 'presenter' ? '' : 'speaker-two'}`}
                      />
                      <strong>{speaker?.name}</strong>
                      <span>{formatTime(Math.max(segment.start, start))}</span>
                    </div>
                    {segment.paragraphs.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <div className="share-meeting-summary">
        <span className="small-label">MEETING CONTEXT</span>
        <h2>{meetingTitle}</h2>
        <p>{meetingSummary}</p>
      </div>
    </article>
  );
}
