import { describe, expect, it } from 'vitest';
import { meetings, searchDocuments } from '../../tests/support/recording-fixture';
import {
  contextualSnippet,
  meetingSearchDocumentsSchema,
  searchMeetingLibrary,
} from './search';

describe('cross-meeting search', () => {
  it('finds title, summary, participant, and transcript matches', () => {
    const kinds = (query: string) =>
      searchMeetingLibrary(meetings, searchDocuments, query).flatMap((result) =>
        result.matches.map((match) => match.kind),
      );
    expect(kinds('pilot planning')).toEqual(['title']);
    expect(kinds('pricing')).toEqual(['summary']);
    expect(kinds('taylor')).toContain('participant');
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'stop recording')[0].matches,
    ).toContainEqual(
      expect.objectContaining({ kind: 'transcript', speaker: 'Taylor', timestamp: 57 }),
    );
  });

  it('returns every meeting with context, case-insensitively', () => {
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'CONTEXT').map(
        (result) => result.meeting.id,
      ),
    ).toEqual(['pilot-planning', 'customer-check-in']);
    expect(searchMeetingLibrary(meetings, searchDocuments, '  ')).toEqual([]);
  });

  it('ignores an empty summary rather than matching it', () => {
    const blank = [{ ...meetings[0], summary: '' }];
    expect(searchMeetingLibrary(blank, [], 'pilot')[0].matches).toEqual([
      expect.objectContaining({ kind: 'title' }),
    ]);
  });

  it('keeps the matching phrase inside a compact contextual snippet', () => {
    const text = `${'Earlier context '.repeat(20)}critical handoff${' later context'.repeat(20)}`;
    const snippet = contextualSnippet(text, 'critical handoff', 100);
    expect(snippet).toContain('critical handoff');
    expect(snippet.length).toBeLessThanOrEqual(102);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('rejects duplicate meeting and segment identities', () => {
    expect(
      meetingSearchDocumentsSchema.safeParse([
        searchDocuments[0],
        searchDocuments[0],
      ]).success,
    ).toBe(false);
    expect(
      meetingSearchDocumentsSchema.safeParse([
        {
          meetingId: 'one',
          transcript: [
            searchDocuments[0].transcript[0],
            searchDocuments[0].transcript[0],
          ],
        },
      ]).success,
    ).toBe(false);
  });
});
