import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  LoaderCircle,
  MonitorUp,
  Radio,
  Unplug,
  Users,
} from 'lucide-react';
import {
  meetingPlatform,
  platformLabels,
  type CalendarEvent,
  type Capabilities,
  type Notetaker,
} from '../../../../packages/shared/notetaker';
import {
  createNotetaker,
  disconnectCalendar,
  notetakerStatusLabels,
  setAutoRecord,
  toggleEventNotetaker,
  useActiveNotetakers,
  useCalendar,
  useCapabilities,
  useNow,
} from '../data/notetakers';
import { captureSupported } from '../data/capture';
import './notetaker.css';

const calendarMessages: Record<string, [string, boolean]> = {
  connected: ['Google Calendar connected.', false],
  denied: ['Google Calendar access was not granted.', true],
  expired: ['That sign-in took too long. Try connecting again.', true],
  failed: ['Google Calendar could not be connected. Try again.', true],
};

function timeRange(start: string, end: string) {
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(start).toLocaleTimeString(undefined, options)} – ${new Date(end).toLocaleTimeString(undefined, options)}`;
}
function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function NotetakerStatus({ notetaker }: { notetaker: Notetaker }) {
  return (
    <span className={`notetaker-status ${notetaker.status}`}>
      {notetaker.status === 'recording' && <span className="live-dot" aria-hidden="true" />}
      {notetakerStatusLabels[notetaker.status]}
    </span>
  );
}

/** Live and upcoming calls, shown on the dashboard and the record page. */
export function ActiveNotetakers({ compact = false }: { compact?: boolean }) {
  const { items } = useActiveNotetakers();
  if (!items?.length) return null;
  return (
    <section className={`active-notetakers ${compact ? 'compact' : ''}`} aria-labelledby="active-calls">
      <h2 id="active-calls">Live and upcoming calls</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/app/live/${item.id}`}>
              <span className="notetaker-icon">
                {item.provider === 'recall' ? <Bot size={17} /> : <MonitorUp size={17} />}
              </span>
              <span className="notetaker-text">
                <strong>{item.title}</strong>
                <small>
                  {item.status === 'scheduled'
                    ? `${dayLabel(item.joinAt)}, ${new Date(item.joinAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                    : item.statusDetail ?? platformLabels[item.platform]}
                </small>
              </span>
              <NotetakerStatus notetaker={item} />
              <ArrowRight size={15} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecordNow({ capabilities }: { capabilities: Capabilities }) {
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<'recall' | 'browser' | null>(null);
  const [error, setError] = useState('');
  const validLink = !link.trim() || meetingPlatform(link.trim()) !== null;
  async function start(provider: 'recall' | 'browser') {
    setError('');
    if (provider === 'recall' && !link.trim())
      return setError('Paste the meeting link the notetaker should join.');
    if (!validLink) return setError('Use a Google Meet, Zoom, or Teams link.');
    setBusy(provider);
    try {
      const notetaker = await createNotetaker({
        provider,
        meetingUrl: link.trim() || undefined,
        title: title.trim() || undefined,
      });
      navigate(`/app/live/${notetaker.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The notetaker could not start.');
      setBusy(null);
    }
  }
  return (
    <section className="record-now" aria-labelledby="record-now-title">
      <div className="record-now-copy">
        <span className="eyebrow">RECORD A CALL NOW</span>
        <h2 id="record-now-title">Bring the notetaker to a call</h2>
        <p>
          {capabilities.bot
            ? 'Paste a Google Meet, Zoom, or Teams link. The notetaker joins as a guest, so let it in when it knocks.'
            : 'Start the call, then record it from this browser. The meeting tab’s audio and your microphone are captured and transcribed.'}
        </p>
      </div>
      <form
        className="record-now-form"
        onSubmit={(event) => {
          event.preventDefault();
          void start(capabilities.bot ? 'recall' : 'browser');
        }}
      >
        <label>
          <span>
            Meeting link{' '}
            {!capabilities.bot && <span className="optional">(optional)</span>}
          </span>
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            inputMode="url"
            aria-invalid={!validLink}
          />
        </label>
        <label>
          <span>
            Title <span className="optional">(optional)</span>
          </span>
          <input
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly product sync"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="record-now-actions">
          {capabilities.bot && (
            <button className="primary-button" type="submit" disabled={!!busy}>
              {busy === 'recall' ? <LoaderCircle className="spin" size={16} /> : <Bot size={16} />}
              Send notetaker
            </button>
          )}
          <button
            className={capabilities.bot ? 'secondary-button' : 'primary-button'}
            type="button"
            disabled={!!busy || !captureSupported()}
            onClick={() => void start('browser')}
            title={captureSupported() ? undefined : 'Recording from the browser needs desktop Chrome or Edge'}
          >
            {busy === 'browser' ? <LoaderCircle className="spin" size={16} /> : <MonitorUp size={16} />}
            Record from this browser
          </button>
        </div>
        {!captureSupported() && (
          <p className="muted small">Recording from the browser needs desktop Chrome or Edge.</p>
        )}
      </form>
    </section>
  );
}

function EventRow({
  event,
  capabilities,
  onChanged,
}: {
  event: CalendarEvent;
  capabilities: Capabilities;
  onChanged: (event: CalendarEvent) => void;
}) {
  const navigate = useNavigate();
  const now = useNow(60000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active =
    event.notetaker &&
    !['failed', 'cancelled'].includes(event.notetaker.status);
  const live = event.notetaker && ['joining', 'waiting_room', 'recording', 'processing'].includes(event.notetaker.status);
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const notetaker = await toggleEventNotetaker(event.id, !active);
      onChanged({ ...event, notetaker });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  async function recordHere() {
    setBusy(true);
    setError('');
    try {
      const notetaker = await createNotetaker({
        provider: 'browser',
        title: event.title.slice(0, 120),
        meetingUrl: event.meetingUrl ?? undefined,
      });
      navigate(`/app/live/${notetaker.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording could not start.');
      setBusy(false);
    }
  }
  const happening = Date.parse(event.start) <= now + 5 * 60000 && Date.parse(event.end) > now;
  return (
    <li className={`calendar-event ${happening ? 'now' : ''}`}>
      <div className="event-time">{timeRange(event.start, event.end)}</div>
      <div className="event-main">
        <strong>{event.title}</strong>
        <small>
          {event.platform ? platformLabels[event.platform] : 'No video link'}
          {event.attendees > 1 && (
            <>
              {' · '}
              <Users size={12} /> {event.attendees}
            </>
          )}
        </small>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="event-actions">
        {event.notetaker && <NotetakerStatus notetaker={event.notetaker} />}
        {live && event.notetaker ? (
          <Link className="secondary-button small" to={`/app/live/${event.notetaker.id}`}>
            <Radio size={14} /> Open live view
          </Link>
        ) : event.meetingUrl && capabilities.bot ? (
          <button
            className={`notetaker-toggle ${active ? 'on' : ''}`}
            type="button"
            role="switch"
            aria-checked={!!active}
            aria-label={`Notetaker for ${event.title}`}
            disabled={busy}
            onClick={() => void toggle()}
          >
            <span className="track" aria-hidden="true">
              <span className="thumb" />
            </span>
            {active ? 'Notetaker on' : 'Notetaker off'}
          </button>
        ) : event.meetingUrl && happening && captureSupported() ? (
          <button className="secondary-button small" type="button" disabled={busy} onClick={() => void recordHere()}>
            <MonitorUp size={14} /> Record from browser
          </button>
        ) : null}
        {event.meetingUrl && (
          <a className="icon-link" href={event.meetingUrl} target="_blank" rel="noreferrer" aria-label={`Open ${event.title}`}>
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </li>
  );
}

function CalendarSection({ capabilities }: { capabilities: Capabilities }) {
  const [params, setParams] = useSearchParams();
  const { state, setState, error, refresh } = useCalendar(capabilities.calendar);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const notice = calendarMessages[params.get('calendar') ?? ''];
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      params.delete('calendar');
      setParams(params, { replace: true });
    }, 6000);
    return () => clearTimeout(timer);
  }, [notice, params, setParams]);

  if (!capabilities.calendar)
    return (
      <section className="calendar-panel" aria-labelledby="calendar-title">
        <h2 id="calendar-title">
          <CalendarDays size={18} /> Calendar
        </h2>
        <p className="muted">
          Google Calendar isn’t set up on this server yet. Add a Google OAuth
          client to enable it (see the README), or record calls from the box
          above.
        </p>
      </section>
    );

  const events = state?.events ?? [];
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = dayLabel(event.start);
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return (
    <section className="calendar-panel" aria-labelledby="calendar-title">
      <div className="calendar-heading">
        <h2 id="calendar-title">
          <CalendarDays size={18} /> Calendar
        </h2>
        {state?.connected && (
          <div className="calendar-account">
            <span className="muted">{state.email}</span>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void disconnectCalendar()
                  .then(refresh)
                  .catch(() => setActionError('Could not disconnect. Retry.'))
                  .finally(() => setBusy(false));
              }}
            >
              <Unplug size={14} /> Disconnect
            </button>
          </div>
        )}
      </div>
      {notice && (
        <p className={notice[1] ? 'form-error' : 'form-success'} role="status">
          {notice[0]}
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}{' '}
          <button className="text-button" type="button" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {!state && !error && (
        <div className="loading-lines" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      {state && !state.connected && (
        <div className="calendar-connect">
          <CalendarPlus size={28} />
          <div>
            <h3>Connect Google Calendar</h3>
            <p className="muted">
              See your upcoming calls here and choose which ones the notetaker
              joins. Read-only access to your events; nothing is changed.
            </p>
          </div>
          <a className="primary-button" href="/api/calendar/connect">
            Connect Google Calendar
          </a>
        </div>
      )}
      {state?.connected && (
        <>
          <label className={`auto-record ${capabilities.bot ? '' : 'disabled'}`}>
            <input
              type="checkbox"
              checked={state.autoRecord}
              disabled={busy || !capabilities.bot}
              onChange={(event) => {
                const next = event.target.checked;
                setBusy(true);
                setActionError('');
                void setAutoRecord(next)
                  .then(() => {
                    setState({ ...state, autoRecord: next });
                    refresh();
                  })
                  .catch((e: unknown) =>
                    setActionError(e instanceof Error ? e.message : 'Could not save that setting.'),
                  )
                  .finally(() => setBusy(false));
              }}
            />
            <span>
              <strong>Auto-record meetings with a video link</strong>
              <small>
                {capabilities.bot
                  ? 'The notetaker joins every upcoming call on this calendar. You can still switch off any one call.'
                  : 'Needs the notetaker bot, which is not set up on this server.'}
              </small>
            </span>
          </label>
          {events.length ? (
            [...groups].map(([day, items]) => (
              <div className="calendar-day" key={day}>
                <h3>{day}</h3>
                <ul>
                  {items.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      capabilities={capabilities}
                      onChanged={(next) =>
                        setState({
                          ...state,
                          events: state.events.map((item) => (item.id === next.id ? next : item)),
                        })
                      }
                    />
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="muted">No meetings in the next seven days.</p>
          )}
        </>
      )}
    </section>
  );
}

export function RecordMeeting() {
  const capabilities = useCapabilities();
  useEffect(() => {
    document.title = 'Record · Fathom Clone';
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">NOTETAKER</div>
          <h1>Record a meeting</h1>
          <p>Send the notetaker to a call now, or let it join from your calendar.</p>
        </div>
      </div>
      {!capabilities ? (
        <div className="empty-state" role="status">
          <h3>Loading…</h3>
        </div>
      ) : (
        <div className="record-layout">
          <RecordNow capabilities={capabilities} />
          <ActiveNotetakers />
          <CalendarSection capabilities={capabilities} />
        </div>
      )}
    </>
  );
}
