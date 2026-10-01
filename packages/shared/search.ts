import { z } from 'zod';
import type { Meeting } from './meeting';

export const searchTranscriptSegmentSchema = z.object({
  id: z.string().min(1),
  speaker: z.string().min(1),
  start: z.number().nonnegative(),
  text: z.string().min(1),
});

export const meetingSearchDocumentSchema = z.object({
  meetingId: z.string().min(1),
  transcript: z.array(searchTranscriptSegmentSchema),
});

export const meetingSearchDocumentsSchema = z
  .array(meetingSearchDocumentSchema)
  .superRefine((documents, context) => {
    const meetingIds = new Set<string>();
    documents.forEach((document, documentIndex) => {
      if (meetingIds.has(document.meetingId)) {
        context.addIssue({
          code: 'custom',
          path: [documentIndex, 'meetingId'],
          message: 'Duplicate meeting search document',
        });
      }
      meetingIds.add(document.meetingId);
      const segmentIds = new Set<string>();
      document.transcript.forEach((segment, segmentIndex) => {
        if (segmentIds.has(segment.id)) {
          context.addIssue({
            code: 'custom',
            path: [documentIndex, 'transcript', segmentIndex, 'id'],
            message: 'Duplicate transcript search segment',
          });
        }
        segmentIds.add(segment.id);
      });
    });
  });

export type MeetingSearchDocument = z.infer<
  typeof meetingSearchDocumentSchema
>;
export type SearchMatchKind = 'title' | 'summary' | 'participant' | 'transcript';
export type SearchMatch = {
  id: string;
  kind: SearchMatchKind;
  text: string;
  speaker?: string;
  timestamp?: number;
};
export type MeetingSearchResult = {
  meeting: Meeting;
  matches: SearchMatch[];
};

function includesQuery(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query);
}

export function contextualSnippet(
  text: string,
  query: string,
  maximumLength = 190,
): string {
  const normalized = query.trim().toLocaleLowerCase();
  const matchIndex = text.toLocaleLowerCase().indexOf(normalized);
  if (!normalized || matchIndex < 0 || text.length <= maximumLength) return text;
  const halfContext = Math.max(20, Math.floor((maximumLength - normalized.length) / 2));
  let start = Math.max(0, matchIndex - halfContext);
  let end = Math.min(text.length, matchIndex + normalized.length + halfContext);
  if (start > 0) {
    const nextSpace = text.indexOf(' ', start);
    if (nextSpace > start && nextSpace < matchIndex) start = nextSpace + 1;
  }
  if (end < text.length) {
    const priorSpace = text.lastIndexOf(' ', end);
    if (priorSpace > matchIndex + normalized.length) end = priorSpace;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function searchMeeting(
  meeting: Meeting,
  document: MeetingSearchDocument | undefined,
  query: string,
): SearchMatch[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const matches: SearchMatch[] = [];
  if (includesQuery(meeting.title, normalized)) {
    matches.push({ id: 'title', kind: 'title', text: meeting.title });
  }
  if (includesQuery(meeting.summary, normalized)) {
    matches.push({ id: 'summary', kind: 'summary', text: meeting.summary });
  }
  meeting.participants.forEach((participant, index) => {
    if (includesQuery(participant, normalized)) {
      matches.push({
        id: `participant-${index}`,
        kind: 'participant',
        text: participant,
      });
    }
  });
  document?.transcript.forEach((segment) => {
    if (includesQuery(segment.text, normalized)) {
      matches.push({
        id: segment.id,
        kind: 'transcript',
        text: contextualSnippet(segment.text, normalized),
        speaker: segment.speaker,
        timestamp: segment.start,
      });
    }
  });
  return matches;
}

export function searchMeetingLibrary(
  meetings: Meeting[],
  documents: MeetingSearchDocument[],
  query: string,
  category: string,
): MeetingSearchResult[] {
  const documentsByMeeting = new Map(
    documents.map((document) => [document.meetingId, document]),
  );
  return meetings.flatMap((meeting) => {
    if (category !== 'All meetings' && category !== meeting.category) return [];
    const matches = searchMeeting(
      meeting,
      documentsByMeeting.get(meeting.id),
      query,
    );
    return matches.length ? [{ meeting, matches }] : [];
  });
}
