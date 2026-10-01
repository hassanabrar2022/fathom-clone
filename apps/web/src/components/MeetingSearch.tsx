import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  Clock3,
  FileText,
  MessageSquareText,
  Search,
  UserRound,
} from 'lucide-react';
import { formatTime } from '../../../../packages/shared/meeting';
import type {
  MeetingSearchResult,
  SearchMatch,
  SearchMatchKind,
} from '../../../../packages/shared/search';

const matchLabels: Record<SearchMatchKind, string> = {
  title: 'Title',
  summary: 'Summary',
  participant: 'Participant',
  transcript: 'Transcript',
};

function MatchIcon({ kind }: { kind: SearchMatchKind }) {
  if (kind === 'transcript') return <MessageSquareText size={14} />;
  if (kind === 'participant') return <UserRound size={14} />;
  return <FileText size={14} />;
}

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return text;
  const lowerText = text.toLocaleLowerCase();
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(normalized);
  while (matchIndex >= 0) {
    if (matchIndex > cursor) pieces.push(text.slice(cursor, matchIndex));
    pieces.push(
      <mark key={`${matchIndex}-${cursor}`}>
        {text.slice(matchIndex, matchIndex + normalized.length)}
      </mark>,
    );
    cursor = matchIndex + normalized.length;
    matchIndex = lowerText.indexOf(normalized, cursor);
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return <>{pieces}</>;
}

export function searchDestination(
  meetingId: string,
  match: SearchMatch,
  query: string,
): string {
  const params = new URLSearchParams({ q: query.trim(), source: match.kind });
  if (match.timestamp !== undefined) params.set('t', String(match.timestamp));
  return `/app/meetings/${meetingId}?${params}#search-context`;
}

export function MeetingSearchResults({
  results,
  query,
}: {
  results: MeetingSearchResult[];
  query: string;
}) {
  const matchCount = results.reduce(
    (total, result) => total + result.matches.length,
    0,
  );
  return (
    <section className="search-results" aria-labelledby="search-results-title">
      <div className="search-results-heading">
        <span className="search-results-icon">
          <Search size={17} />
        </span>
        <div>
          <h3 id="search-results-title">
            {results.length} {results.length === 1 ? 'meeting' : 'meetings'}{' '}
            found
          </h3>
          <p>
            {matchCount} matching {matchCount === 1 ? 'passage' : 'passages'}{' '}
            for “{query.trim()}”
          </p>
        </div>
      </div>
      <div className="search-result-list">
        {results.map((result) => (
          <article className="search-result-card" key={result.meeting.id}>
            <header>
              <span
                className={`meeting-icon ${result.meeting.category.toLowerCase()}`}
              >
                <AudioLines size={20} />
              </span>
              <div>
                <Link to={`/app/meetings/${result.meeting.id}`}>
                  {result.meeting.title}
                </Link>
                <span>
                  {result.meeting.provenance === 'uploaded'
                    ? 'Private recording'
                    : result.meeting.provenance === 'reference-recording'
                      ? 'Real recording · Imported transcript'
                      : `${result.meeting.category} · Synthetic demo`}
                </span>
              </div>
              <span className="search-result-date">
                {new Intl.DateTimeFormat('en', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(result.meeting.date))}
              </span>
            </header>
            <div className="search-match-list">
              {result.matches.slice(0, 3).map((match) => (
                <Link
                  key={match.id}
                  className="search-match"
                  to={searchDestination(result.meeting.id, match, query)}
                  aria-label={`Open ${result.meeting.title} ${matchLabels[match.kind].toLocaleLowerCase()} match${match.timestamp === undefined ? '' : ` at ${formatTime(match.timestamp)}`}`}
                >
                  <span className={`search-match-kind ${match.kind}`}>
                    <MatchIcon kind={match.kind} /> {matchLabels[match.kind]}
                  </span>
                  <span className="search-match-copy">
                    {match.speaker && <strong>{match.speaker}</strong>}
                    <span>
                      <HighlightText text={match.text} query={query} />
                    </span>
                  </span>
                  {match.timestamp !== undefined ? (
                    <span className="search-match-time">
                      <Clock3 size={12} /> {formatTime(match.timestamp)}
                    </span>
                  ) : (
                    <ArrowRight size={15} className="search-match-arrow" />
                  )}
                </Link>
              ))}
            </div>
            {result.matches.length > 3 && (
              <p className="search-more-matches">
                +{result.matches.length - 3} more matching passages
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
