/** Product UI illustrations for the marketing site, built from real app concepts. */
import {
  BookmarkPlus,
  CheckCircle2,
  Circle,
  FileText,
  Link2,
  Play,
  Sparkles,
} from 'lucide-react';

function Avatar({ initials, tone }: { initials: string; tone: number }) {
  return <span className={`mock-avatar tone-${tone}`}>{initials}</span>;
}

export function MockCall() {
  return (
    <div className="mock-call">
      <div className="mock-tile tone-1">
        <Avatar initials="MR" tone={1} />
        <span className="mock-tile-name">Maya</span>
      </div>
      <div className="mock-tile tone-2">
        <Avatar initials="JO" tone={2} />
        <span className="mock-tile-name">Jordan</span>
      </div>
    </div>
  );
}

export function MockSummary({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mock-panel ${compact ? 'is-compact' : ''}`}>
      <div className="mock-tabs">
        <span className="is-active">
          <Sparkles size={12} /> Summary
        </span>
        <span>Transcript</span>
        <span>Moments</span>
      </div>
      <div className="mock-heading">
        Summary <u>General</u>
      </div>
      <h5>Meeting purpose</h5>
      <ul>
        <li>Quarterly planning review for the mobile launch.</li>
      </ul>
      <h5>Key takeaways</h5>
      <ul>
        <li className="is-linked">
          <Circle size={9} /> Beta feedback favors the new onboarding flow.
          <em>12:47</em>
        </li>
        <li>Pricing page copy needs a final review before launch.</li>
        {!compact && <li>Support volume is expected to rise in week one.</li>}
      </ul>
      <h5>Action items</h5>
      <ul className="mock-actions">
        <li>
          <CheckCircle2 size={13} /> Jordan sends the revised proposal
          <em>Fri</em>
        </li>
        <li>
          <Circle size={13} /> Maya shares beta survey results
          <em>18:02</em>
        </li>
      </ul>
    </div>
  );
}

export function MockTranscript() {
  const turns = [
    ['Maya', '12:41', 'Let’s look at what the beta group told us about onboarding.'],
    ['Jordan', '12:47', 'Most of them finished setup in under five minutes this time.', true],
    ['Maya', '13:05', 'Great — that was the main drop-off before.'],
    ['Jordan', '13:12', 'I’ll send the revised proposal by Friday.'],
  ] as const;
  return (
    <div className="mock-panel">
      <div className="mock-tabs">
        <span>Summary</span>
        <span className="is-active">
          <FileText size={12} /> Transcript
        </span>
        <span>Moments</span>
      </div>
      <div className="mock-transcript">
        {turns.map(([name, time, text, active]) => (
          <div key={time} className={active ? 'is-active' : ''}>
            <strong>
              {name} <em>{time}</em>
            </strong>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockActions() {
  return (
    <div className="mock-panel">
      <div className="mock-heading">Action items</div>
      <ul className="mock-actions is-large">
        {[
          ['Send the revised proposal', 'Jordan · by Friday', '13:12'],
          ['Share beta survey results', 'Maya · this week', '18:02'],
          ['Review pricing page copy', 'Unassigned', '21:40'],
        ].map(([task, owner, time], index) => (
          <li key={task}>
            {index === 0 ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            <span>
              {task}
              <small>{owner}</small>
            </span>
            <em>
              <Play size={9} /> {time}
            </em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MockMoments() {
  return (
    <div className="mock-panel">
      <div className="mock-tabs">
        <span>Summary</span>
        <span>Transcript</span>
        <span className="is-active">
          <BookmarkPlus size={12} /> Moments
        </span>
      </div>
      <div className="mock-moment">
        <span className="mock-play">
          <Play size={12} />
        </span>
        <div>
          <strong>Customer names their budget</strong>
          <small>12:47–13:20 · Shared by link</small>
        </div>
        <span className="mock-chip">
          <Link2 size={11} /> Copy link
        </span>
      </div>
      <div className="mock-moment">
        <span className="mock-play">
          <Play size={12} />
        </span>
        <div>
          <strong>Onboarding feedback</strong>
          <small>18:02–18:40 · Private</small>
        </div>
        <span className="mock-chip">Share</span>
      </div>
    </div>
  );
}
