import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Search,
  Pencil,
  Users,
} from 'lucide-react';
import { formatTime, type Meeting } from '../../../../packages/shared/meeting';
import {
  transcriptFilename,
  transcriptSegmentText,
  transcriptText,
} from '../../../../packages/shared/export';
import {
  activeSegment,
  boundedTime,
  momentRange,
  recordingSchema,
  type Recording,
} from '../../../../packages/shared/recording';
import { contextualSnippet } from '../../../../packages/shared/search';
import { HighlightText } from './MeetingSearch';
import { MeetingIntelligence } from './MeetingIntelligence';
import { MeetingMoments, type MomentDraft } from './MeetingMoments';
import { MeetingShareControl } from './MeetingShareControl';
import { uploadApi } from '../data/uploads';
import './recording.css';

export function RecordingMeeting({
  meeting,
  initialSeek,
  searchQuery,
}: {
  meeting: Meeting;
  initialSeek?: number;
  searchQuery?: string;
}) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let disposed = false;
    async function load() {
      try {
        const response = await fetch(`/api/meetings/${meeting.id}/recording`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Recording unavailable');
        const result = recordingSchema.parse(await response.json());
        if (!disposed) setRecording(result);
      } catch {
        if (!disposed) setError(true);
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
  }, [meeting.id, attempt]);

  return (
    <>
      <Link to="/app" className="back-link">
        <ArrowLeft size={16} /> All meetings
      </Link>
      <div className="detail-heading recording-heading">
        <div>
          <div className="eyebrow">
            {meeting.provenance === 'reference-recording' ? 'REFERENCE RECORDING' : 'MEETING RECORDING'} ·{' '}
            {new Date(meeting.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <h1>{meeting.title}</h1>
          <div className="detail-meta">
            <span>
              <Clock3 size={15} />
              {formatTime(meeting.duration)}
            </span>
            <span>
              <Users size={15} />
              {meeting.participants.length} speakers
            </span>
            <span className="recording-ready">
              <span />
              Recording available
            </span>
          </div>
        </div>
        <span className="source-badge">
          <AudioLines size={16} /> Real recording
        </span>
      </div>
      {recording && <MeetingShareControl meetingId={meeting.id} />}
      {error ? (
        <section className="recording-load-state" role="alert">
          <FileText size={30} />
          <h2>We couldn’t load this meeting</h2>
          <p>
            Check your connection and try again. Your meeting is still in the
            library.
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            <RotateCcw size={16} /> Retry meeting
          </button>
        </section>
      ) : recording ? (
        <RecordingExperience
          key={meeting.id}
          recording={recording}
          meetingTitle={meeting.title}
          initialSeek={initialSeek}
          searchQuery={searchQuery}
          onRenameSpeaker={async (speakerId, name) => {
            await uploadApi('session', 'POST');
            await uploadApi(`meetings/${meeting.id}/speakers`, 'PATCH', {
              speakerId,
              name,
            });
          }}
        />
      ) : (
        <section className="recording-load-state" role="status">
          <LoaderCircle className="loading-icon" size={26} />
          <h2>Loading your conversation</h2>
          <p>Fetching the recording details and timestamped transcript…</p>
          <div className="loading-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      )}
    </>
  );
}

export function RecordingExperience({
  recording,
  meetingTitle,
  initialSeek,
  searchQuery,
  privateMeeting = false,
  analysisFeedback,
  onRenameSpeaker,
}: {
  recording: Omit<Recording, 'intelligence' | 'posterUrl'> & {
    intelligence: Recording['intelligence'] | null;
    posterUrl?: string;
  };
  meetingTitle: string;
  initialSeek?: number;
  searchQuery?: string;
  privateMeeting?: boolean;
  analysisFeedback?: React.ReactNode;
  onRenameSpeaker?: (speakerId: string, name: string) => Promise<void>;
}) {
  const initialTime = boundedTime(initialSeek ?? 0, recording.duration);
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(
    initialSeek === undefined ? null : initialTime,
  );
  const transcript = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(recording.duration);
  const [playing, setPlaying] = useState(false);
  const [state, setState] = useState<
    'loading' | 'ready' | 'buffering' | 'error'
  >('loading');
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [transcriptQuery, setTranscriptQuery] = useState(searchQuery ?? '');
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(-1);
  const [notice, setNotice] = useState('');
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [momentDraft, setMomentDraft] = useState<MomentDraft | null>(null);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>(
    () => {
      const names = Object.fromEntries(
        recording.speakers.map((speaker) => [speaker.id, speaker.name]),
      );
      return names;
    },
  );
  const [editingSpeaker, setEditingSpeaker] = useState<{
    id: string;
    segmentId: string;
  } | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState('');
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [speakerError, setSpeakerError] = useState('');
  const [transcriptCopyState, setTranscriptCopyState] =
    useState('Copy transcript');
  const [segmentCopyState, setSegmentCopyState] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const momentRequest = useRef(0);
  const activeId = activeSegment(recording.segments, time);
  const normalizedQuery = transcriptQuery.trim().toLocaleLowerCase();
  async function saveSpeaker(event: React.FormEvent) {
    event.preventDefault();
    if (!editingSpeaker || speakerSaving) return;
    const name = speakerDraft.trim();
    if (
      !name ||
      name.length > 60 ||
      [...name].some((character) => character.charCodeAt(0) < 32)
    ) {
      setSpeakerError('Enter a speaker name up to 60 characters.');
      return;
    }
    setSpeakerSaving(true);
    setSpeakerError('');
    const next = { ...speakerNames, [editingSpeaker.id]: name };
    try {
      if (onRenameSpeaker) await onRenameSpeaker(editingSpeaker.id, name);
      else throw new Error('Speaker edits are unavailable');
      setSpeakerNames(next);
      setEditingSpeaker(null);
    } catch {
      setSpeakerError('Could not save this speaker name. Please retry.');
    } finally {
      setSpeakerSaving(false);
    }
  }

  const exportSpeakers = recording.speakers.map((speaker) => ({
    ...speaker,
    name: speakerNames[speaker.id] ?? speaker.name,
  }));

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(
        transcriptText(meetingTitle, recording.segments, exportSpeakers),
      );
      setTranscriptCopyState('Transcript copied');
    } catch {
      setTranscriptCopyState('Copy failed — try again');
    }
  }

  function downloadTranscript() {
    const url = URL.createObjectURL(
      new Blob(
        [transcriptText(meetingTitle, recording.segments, exportSpeakers)],
        { type: 'text/plain;charset=utf-8' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = transcriptFilename(meetingTitle);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copySegment(segment: Recording['segments'][number]) {
    const text = transcriptSegmentText(
      segment,
      speakerNames[segment.speakerId] ?? 'Speaker',
    );
    try {
      await navigator.clipboard.writeText(text);
      setSegmentCopyState({ id: segment.id, message: 'Segment copied' });
    } catch {
      setSegmentCopyState({
        id: segment.id,
        message: 'Copy failed — try again',
      });
    }
  }
  const transcriptMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return recording.segments.flatMap((segment) =>
      segment.paragraphs.flatMap((paragraph, paragraphIndex) =>
        paragraph.toLocaleLowerCase().includes(normalizedQuery)
          ? [{ segment, paragraph, paragraphIndex }]
          : [],
      ),
    );
  }, [recording.segments, normalizedQuery]);

  useEffect(() => {
    if (!follow || !playing || !activeId) return;
    const container = transcript.current;
    const row = container?.querySelector<HTMLElement>(
      `[data-segment-id="${CSS.escape(activeId)}"]`,
    );
    row?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [activeId, follow, playing]);

  useEffect(() => {
    if (state !== 'loading' && state !== 'buffering') return;
    const timer = window.setTimeout(
      () =>
        setNotice(
          'The recording is taking longer than usual. Check your connection or reload the recording.',
        ),
      15000,
    );
    return () => window.clearTimeout(timer);
  }, [state, mediaAttempt]);

  function seek(timestamp: number) {
    const element = video.current;
    if (!element || state === 'error') return;
    const next = boundedTime(timestamp, duration);
    setNotice('');
    if (element.readyState < 1) pendingSeek.current = next;
    else element.currentTime = next;
    setTime(next);
  }

  function ready() {
    const element = video.current;
    if (!element) return;
    if (Number.isFinite(element.duration)) setDuration(element.duration);
    element.playbackRate = speed;
    if (pendingSeek.current !== null) {
      element.currentTime = boundedTime(pendingSeek.current, element.duration);
      pendingSeek.current = null;
    }
    setNotice('');
    setState('ready');
  }

  function retryMedia() {
    setMediaAttempt((value) => value + 1);
    pendingSeek.current = time;
    setNotice('');
    setPlaying(false);
    setState('loading');
    video.current?.load();
  }

  async function togglePlayback() {
    if (!video.current) return;
    if (!video.current.paused) {
      video.current.pause();
      return;
    }
    try {
      await video.current.play();
      setNotice('');
    } catch {
      setNotice(
        'Playback couldn’t start. Try Play again or use the video controls.',
      );
    }
  }

  function prepareMoment(start: number, selectedEnd?: number) {
    momentRequest.current += 1;
    const range = momentRange(start, duration, selectedEnd);
    setMomentDraft({
      requestId: momentRequest.current,
      start: range.startMs / 1000,
      end: range.endMs / 1000,
    });
  }

  function showSearchContext() {
    if (initialSeek === undefined) return;
    seek(initialSeek);
    const segmentId = activeSegment(recording.segments, initialSeek);
    const row = segmentId
      ? transcript.current?.querySelector<HTMLElement>(
          `[data-segment-id="${CSS.escape(segmentId)}"]`,
        )
      : null;
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function openTranscriptMatch(index: number) {
    const match = transcriptMatches[index];
    if (!match) return;
    setSelectedMatchIndex(index);
    seek(match.segment.start);
    const row = transcript.current?.querySelector<HTMLElement>(
      `[data-segment-id="${CSS.escape(match.segment.id)}"]`,
    );
    row?.querySelectorAll('p')[match.paragraphIndex]?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }

  function navigateTranscriptMatch(direction: -1 | 1) {
    if (!transcriptMatches.length) return;
    const next =
      selectedMatchIndex < 0
        ? direction === 1
          ? 0
          : transcriptMatches.length - 1
        : (selectedMatchIndex + direction + transcriptMatches.length) %
          transcriptMatches.length;
    openTranscriptMatch(next);
  }

  return (
    <div className="recording-layout">
      <section className="recording-column" aria-label="Meeting recording">
        {searchQuery && initialSeek !== undefined && (
          <div className="recording-search-arrival" id="search-context">
            <span>
              <Search size={16} /> Transcript match
            </span>
            <p>
              Opened at {formatTime(initialSeek)} for “{searchQuery}”.
            </p>
            <button onClick={showSearchContext}>View transcript context</button>
          </div>
        )}
        <div className="player-frame">
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            poster={recording.posterUrl}
            src={recording.mediaUrl}
            aria-label={
              privateMeeting
                ? 'Uploaded meeting recording'
                : 'Meeting recording'
            }
            onLoadedMetadata={ready}
            onCanPlay={() => {
              setState('ready');
              setNotice('');
            }}
            onTimeUpdate={() => setTime(video.current?.currentTime ?? 0)}
            onSeeking={() => {
              setTime(video.current?.currentTime ?? 0);
              setState('buffering');
            }}
            onSeeked={() => {
              if ((video.current?.readyState ?? 0) >= 2) {
                setState('ready');
                setNotice('');
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onWaiting={() => setState('buffering')}
            onPlaying={() => setState('ready')}
            onError={() => {
              setState('error');
              setPlaying(false);
            }}
          />
          {state === 'error' && (
            <div className="media-error" role="alert">
              <FileText size={28} />
              <h2>Recording couldn’t load</h2>
              <p>Your transcript is still available.</p>
              <button className="secondary-button" onClick={retryMedia}>
                <RotateCcw size={16} /> Retry recording
              </button>
            </div>
          )}
        </div>
        <div className="player-toolbar">
          <button
            className="transport-button"
            aria-label={playing ? 'Pause recording' : 'Play recording'}
            disabled={state === 'error'}
            onClick={() => void togglePlayback()}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="playback-time" aria-label="Playback position">
            {formatTime(time)} <span>/ {formatTime(Math.ceil(duration))}</span>
          </span>
          <button
            className="save-current-moment"
            onClick={() => prepareMoment(time)}
            aria-label={`Save current moment at ${formatTime(time)}`}
          >
            <BookmarkPlus size={15} /> Save moment
          </button>
          <label className="speed-control">
            Speed
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSpeed(value);
                if (video.current) video.current.playbackRate = value;
              }}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
        </div>
        {(state === 'loading' || state === 'buffering') && (
          <div className="media-status" role="status">
            <LoaderCircle size={15} className="loading-icon" />
            {state === 'loading'
              ? 'Loading recording…'
              : 'Buffering recording…'}
          </div>
        )}
        {notice && (
          <div className="media-status" role="status">
            <p>{notice}</p>
            <button onClick={retryMedia} className="secondary-button">
              Reload recording
            </button>
          </div>
        )}
        {!privateMeeting && (
          <div className="recording-context">
            <div className="card-heading">
              <AudioLines size={19} />
              <h2>About this conversation</h2>
            </div>
            <p>{recording.description}</p>
            {recording.sourceNote && (
              <details className="source-note">
                <summary>About this recording</summary>
                <p>{recording.sourceNote}</p>
              </details>
            )}
          </div>
        )}
        <MeetingMoments
          privateMeeting={privateMeeting}
          meetingId={recording.id}
          duration={duration}
          draft={momentDraft}
          onCloseDraft={() => setMomentDraft(null)}
          onSeek={seek}
          seekDisabled={state === 'error'}
        />
      </section>
      {recording.intelligence ? (
        <MeetingIntelligence
          meetingTitle={meetingTitle}
          intelligence={recording.intelligence}
          onSeek={seek}
          seekDisabled={state === 'error'}
        />
      ) : (
        <section className="intelligence-panel ingestion-analysis">
          {analysisFeedback}
        </section>
      )}
      <section className="transcript-panel" aria-labelledby="transcript-title">
        <div className="transcript-header">
          <div>
            <h2 id="transcript-title">
              Transcript <span>{recording.segments.length} turns</span>
            </h2>
            <p>Click a timestamp to hear it in context.</p>
          </div>
          <div className="transcript-tools">
            {recording.segments.length > 0 && (
              <label className="transcript-search-field">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search this transcript"
                  placeholder="Find in transcript"
                  value={transcriptQuery}
                  onChange={(event) => {
                    setTranscriptQuery(event.target.value);
                    setSelectedMatchIndex(-1);
                  }}
                />
              </label>
            )}
            {recording.segments.length > 0 && (
              <div className="transcript-export-actions">
                <button type="button" onClick={() => void copyTranscript()}>
                  <Copy size={14} aria-hidden="true" />
                  <span aria-live="polite">{transcriptCopyState}</span>
                </button>
                <button type="button" onClick={downloadTranscript}>
                  <Download size={14} aria-hidden="true" />
                  Download .txt
                </button>
              </div>
            )}
            <label className="follow-control">
              <input
                type="checkbox"
                checked={follow}
                onChange={(event) => setFollow(event.target.checked)}
              />
              Follow playback
            </label>
          </div>
        </div>
        {normalizedQuery && (
          <div className="transcript-search-results">
            <div className="transcript-search-heading">
              <strong role="status" aria-live="polite">
                {transcriptMatches.length} matching{' '}
                {transcriptMatches.length === 1 ? 'passage' : 'passages'}
              </strong>
              <div className="transcript-search-actions">
                {transcriptMatches.length > 0 && (
                  <div className="transcript-match-navigation">
                    <span>
                      {selectedMatchIndex < 0
                        ? 'Choose a match'
                        : `${selectedMatchIndex + 1} of ${transcriptMatches.length}`}
                    </span>
                    <button
                      type="button"
                      aria-label="Previous match"
                      onClick={() => navigateTranscriptMatch(-1)}
                    >
                      <ChevronLeft size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next match"
                      onClick={() => navigateTranscriptMatch(1)}
                    >
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setTranscriptQuery('');
                    setSelectedMatchIndex(-1);
                  }}
                >
                  Clear search
                </button>
              </div>
            </div>
            {transcriptMatches.length ? (
              <div className="transcript-match-list">
                {transcriptMatches.map(
                  ({ segment, paragraph, paragraphIndex }, index) => {
                    const speaker =
                      speakerNames[segment.speakerId] ?? 'Speaker';
                    return (
                      <button
                        type="button"
                        className="transcript-match"
                        key={`${segment.id}-${paragraphIndex}`}
                        aria-current={
                          index === selectedMatchIndex ? 'true' : undefined
                        }
                        aria-label={`View match ${index + 1} at ${formatTime(segment.start)} from ${speaker}`}
                        onClick={() => openTranscriptMatch(index)}
                      >
                        <span className="transcript-match-source">
                          {formatTime(segment.start)} <span>· {speaker}</span>
                        </span>
                        <span className="transcript-match-copy">
                          <HighlightText
                            text={contextualSnippet(
                              paragraph,
                              transcriptQuery,
                              150,
                            )}
                            query={transcriptQuery}
                          />
                        </span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    );
                  },
                )}
              </div>
            ) : (
              <p className="transcript-search-empty">
                No transcript passages match “{transcriptQuery.trim()}”. Try
                another word or clear the search.
              </p>
            )}
          </div>
        )}
        <div
          className="transcript-scroll"
          ref={transcript}
          tabIndex={0}
          aria-label="Timestamped transcript"
        >
          <div className="transcript-source">
            <FileText size={14} />{' '}
            {privateMeeting
              ? 'AI transcript · Speaker identities are not inferred'
              : 'Imported transcript · Original speaker timestamps'}
          </div>
          {recording.segments.length === 0 ? (
            <div className="transcript-empty">
              <FileText size={26} />
              <h3>No transcript available</h3>
              <p>You can still listen to the recording using the player.</p>
            </div>
          ) : (
            recording.segments.map((segment) => (
              <article
                key={segment.id}
                data-segment-id={segment.id}
                className={`transcript-turn ${activeId === segment.id ? 'is-active' : ''}`}
                aria-label={`${speakerNames[segment.speakerId]} at ${formatTime(segment.start)}`}
              >
                <div className="turn-heading">
                  <span
                    className={`speaker-dot ${segment.speakerId === 'presenter' ? '' : 'speaker-two'}`}
                  />
                  <button
                    type="button"
                    className="speaker-rename-trigger"
                    aria-label={`Rename ${speakerNames[segment.speakerId]}`}
                    onClick={() => {
                      setEditingSpeaker({
                        id: segment.speakerId,
                        segmentId: segment.id,
                      });
                      setSpeakerDraft(speakerNames[segment.speakerId] ?? '');
                      setSpeakerError('');
                    }}
                  >
                    {speakerNames[segment.speakerId]}{' '}
                    <Pencil size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="segment-copy-trigger"
                    aria-label={`Copy transcript segment at ${formatTime(segment.start)}`}
                    onClick={() => void copySegment(segment)}
                  >
                    <Copy size={13} aria-hidden="true" />
                    <span aria-live="polite">
                      {segmentCopyState?.id === segment.id
                        ? segmentCopyState.message
                        : 'Copy segment'}
                    </span>
                  </button>
                  <button
                    className="moment-trigger"
                    aria-label={`Save moment from transcript at ${formatTime(segment.start)}`}
                    onClick={() =>
                      prepareMoment(
                        segment.start,
                        Math.min(segment.start + 30, segment.end),
                      )
                    }
                  >
                    <BookmarkPlus size={13} />
                    <span>Save moment</span>
                  </button>
                  <button
                    className="timestamp-button"
                    aria-label={`Seek to ${formatTime(segment.start)}`}
                    aria-current={activeId === segment.id ? 'true' : undefined}
                    disabled={state === 'error'}
                    onClick={() => seek(segment.start)}
                  >
                    <Play size={11} />
                    {formatTime(segment.start)}
                  </button>
                </div>
                {editingSpeaker?.segmentId === segment.id && (
                  <form
                    className="speaker-rename-form"
                    onSubmit={(event) => void saveSpeaker(event)}
                  >
                    <label htmlFor={`speaker-${segment.id}`}>
                      Speaker name
                    </label>
                    <input
                      id={`speaker-${segment.id}`}
                      autoFocus
                      maxLength={60}
                      value={speakerDraft}
                      disabled={speakerSaving}
                      onChange={(event) => setSpeakerDraft(event.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={speakerSaving || !speakerDraft.trim()}
                    >
                      {speakerSaving ? 'Saving…' : 'Save name'}
                    </button>
                    <button
                      type="button"
                      disabled={speakerSaving}
                      onClick={() => setEditingSpeaker(null)}
                    >
                      Cancel
                    </button>
                    {speakerError && <span role="alert">{speakerError}</span>}
                  </form>
                )}
                <div className="turn-text">
                  {segment.paragraphs.map((paragraph, index) => (
                    <p key={index}>
                      <HighlightText text={paragraph} query={transcriptQuery} />
                    </p>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
        <div className="transcript-footer">
          {recording.speakers.map((speaker, index) => (
            <span className="transcript-footer-speaker" key={speaker.id}>
              <span
                className={`speaker-dot ${index > 0 ? 'speaker-two' : ''}`}
              />
              {speakerNames[speaker.id]}
            </span>
          ))}
          <span className="transcript-end">End of transcript</span>
        </div>
      </section>
    </div>
  );
}
