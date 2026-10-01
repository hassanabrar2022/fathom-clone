import { useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  ListTodo,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { summaryText } from '../../../../packages/shared/export';
import { formatTime } from '../../../../packages/shared/meeting';
import type {
  MeetingIntelligence as Intelligence,
  SummaryTemplateKey,
} from '../../../../packages/shared/recording';

export function MeetingIntelligence({
  intelligence,
  onSeek,
  seekDisabled,
  meetingTitle,
}: {
  intelligence: Intelligence;
  onSeek: (timestamp: number) => void;
  seekDisabled: boolean;
  meetingTitle: string;
}) {
  const [activeKey, setActiveKey] = useState<SummaryTemplateKey>('general');
  const active =
    intelligence.templates.find((template) => template.key === activeKey) ??
    intelligence.templates[0];
  const [copyState, setCopyState] = useState('Copy summary');

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(
        summaryText(meetingTitle, active, intelligence.actions),
      );
      setCopyState('Summary copied');
    } catch {
      setCopyState('Copy failed — try again');
    }
  }

  return (
    <section
      className="intelligence-panel"
      aria-labelledby="intelligence-title"
    >
      <header className="intelligence-header">
        <div className="intelligence-title-row">
          <span className="intelligence-mark">
            <Sparkles size={17} />
          </span>
          <div>
            <h2 id="intelligence-title">Fathom Clone intelligence</h2>
            <p>AI analysis · grounded in your transcript</p>
          </div>
        </div>
        <span className="ready-pill">
          <CheckCircle2 size={13} /> Ready
        </span>
      </header>

      <div className="template-switcher" aria-label="Summary format">
        {intelligence.templates.map((template) => (
          <button
            key={template.key}
            type="button"
            aria-pressed={template.key === activeKey}
            title={template.descriptor}
            onClick={() => {
              setActiveKey(template.key);
              setCopyState('Copy summary');
            }}
          >
            <strong>{template.label}</strong>
            <span className="sr-only"> {template.descriptor}</span>
          </button>
        ))}
      </div>

      <div className="summary-content" aria-live="polite" key={active.key}>
        <div className="summary-toolbar">
          <div className="summary-kicker">AI SUMMARY · {active.label}</div>
          <button
            type="button"
            className="copy-summary-button"
            onClick={() => void copySummary()}
          >
            <Copy size={13} aria-hidden="true" />
            <span aria-live="polite">{copyState}</span>
          </button>
        </div>
        <h3>{active.title}</h3>
        <p className="summary-overview">{active.overview}</p>
        <div className="summary-sections">
          {active.sections.map((section) => (
            <section key={section.title}>
              <h4>{section.title}</h4>
              {section.items.length === 0 && (
                <p className="analysis-disclosure">
                  No supported findings in this conversation.
                </p>
              )}
              <ul>
                {section.items.map((item) => (
                  <li key={`${item.source}-${item.text}`}>
                    <span>{item.text}</span>
                    <SourceButton
                      timestamp={item.source}
                      onSeek={onSeek}
                      disabled={seekDisabled}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <section className="actions-block" aria-labelledby="actions-title">
        <div className="actions-heading">
          <span>
            <ListTodo size={17} />
            <h3 id="actions-title">Action items</h3>
          </span>
          <small>{intelligence.actions.length} extracted</small>
        </div>
        <div className="action-list">
          {intelligence.actions.length === 0 && (
            <p>
              No supported action items were identified in this conversation.
            </p>
          )}
          {intelligence.actions.map((action, index) => (
            <article className="action-card" key={action.id}>
              <span className="action-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h4>{action.task}</h4>
                <div className="action-meta">
                  <span>
                    <UserRound size={12} />{' '}
                    {action.owner ?? 'Owner not identified'}
                  </span>
                  <span>
                    <CalendarClock size={12} />
                    {action.timing ?? 'No timing stated'}
                  </span>
                </div>
              </div>
              <SourceButton
                timestamp={action.source}
                onSeek={onSeek}
                disabled={seekDisabled}
              />
            </article>
          ))}
        </div>
      </section>

      <p className="analysis-disclosure">
        Generated from this recording. Check the cited transcript before acting
        on a summary.
      </p>
    </section>
  );
}

function SourceButton({
  timestamp,
  onSeek,
  disabled,
}: {
  timestamp: number;
  onSeek: (timestamp: number) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="source-button"
      aria-label={`Seek to source at ${formatTime(timestamp)}`}
      onClick={() => onSeek(timestamp)}
      disabled={disabled}
    >
      {formatTime(timestamp)} <ArrowUpRight size={12} />
    </button>
  );
}
