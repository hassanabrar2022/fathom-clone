import { describe, expect, it } from 'vitest';
import { meetings } from './reviewer-fixture';
import { searchDocuments } from './reviewer-fixture';
import {
  contextualSnippet,
  meetingSearchDocumentsSchema,
  searchMeetingLibrary,
} from './search';

describe('cross-meeting search', () => {
  it('indexes every public demo meeting with bounded transcript timestamps', () => {
    expect(searchDocuments.map((document) => document.meetingId).sort()).toEqual(
      meetings.map((meeting) => meeting.id).sort(),
    );
    searchDocuments.forEach((document) => {
      const duration = meetings.find(
        (meeting) => meeting.id === document.meetingId,
      )!.duration;
      expect(document.transcript.every((segment) => segment.start <= duration)).toBe(
        true,
      );
    });
  });

  it('finds title, summary, transcript, and existing participant matches', () => {
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'noise', 'All meetings')[0]
        .matches[0].kind,
    ).toBe('title');
    expect(
      searchMeetingLibrary(
        meetings,
        searchDocuments,
        'definition of activation',
        'All meetings',
      )[0].matches.some((match) => match.kind === 'summary'),
    ).toBe(true);
    expect(
      searchMeetingLibrary(
        meetings,
        searchDocuments,
        'video is not getting recorded',
        'All meetings',
      )[0].matches,
    ).toContainEqual(
      expect.objectContaining({ kind: 'transcript', timestamp: 97.17 }),
    );
    expect(
      searchMeetingLibrary(
        meetings,
        searchDocuments,
        'stop recording',
        'All meetings',
      )[0].matches,
    ).toContainEqual(
      expect.objectContaining({ kind: 'transcript', timestamp: 57 }),
    );
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'taylor', 'All meetings')[0]
        .matches[0].kind,
    ).toBe('participant');
  });

  it('returns useful multi-meeting context and intersects category filters', () => {
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'context', 'All meetings').map(
        (result) => result.meeting.id,
      ),
    ).toEqual(['customer-discovery', 'design-review']);
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'context', 'Customer').map(
        (result) => result.meeting.id,
      ),
    ).toEqual(['customer-discovery']);
    expect(
      searchMeetingLibrary(meetings, searchDocuments, 'context', 'Product'),
    ).toEqual([]);
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
