import { z } from 'zod';
import type { Segment } from './recording';

export const notetakerStatusSchema = z.enum([
  'scheduled',
  'joining',
  'waiting_room',
  'recording',
  'processing',
  'complete',
  'failed',
  'cancelled',
]);
export type NotetakerStatus = z.infer<typeof notetakerStatusSchema>;
export const activeNotetakerStatuses: readonly NotetakerStatus[] = [
  'scheduled',
  'joining',
  'waiting_room',
  'recording',
  'processing',
];

export const meetingPlatformSchema = z.enum([
  'google_meet',
  'zoom',
  'teams',
  'other',
]);
export type MeetingPlatform = z.infer<typeof meetingPlatformSchema>;

const platformHosts: [RegExp, MeetingPlatform][] = [
  [/^meet\.google\.com$/, 'google_meet'],
  [/(^|\.)zoom\.(us|com)$/, 'zoom'],
  [/^teams\.(microsoft|live)\.com$/, 'teams'],
];

/** The platform behind a meeting link, or null when it is not a meeting link. */
export function meetingPlatform(link: string): MeetingPlatform | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  const platform = platformHosts.find(([pattern]) => pattern.test(host))?.[1];
  if (!platform) return null;
  if (platform === 'google_meet' && !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(url.pathname))
    return null;
  if (platform === 'zoom' && !/^\/(j|my|w)\//.test(url.pathname)) return null;
  return platform;
}

const meetingLinkPattern =
  /https:\/\/(?:meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|[\w.-]*zoom\.(?:us|com)\/(?:j|my|w)\/[^\s"'<>]+|teams\.(?:microsoft|live)\.com\/[^\s"'<>]+)/i;

/** First supported meeting link inside free text (a calendar location or description). */
export function findMeetingLink(...texts: (string | null | undefined)[]) {
  for (const text of texts) {
    const match = text ? meetingLinkPattern.exec(text) : null;
    if (match && meetingPlatform(match[0])) return match[0];
  }
  return null;
}

export const platformLabels: Record<MeetingPlatform, string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  other: 'Meeting',
};

export const createNotetakerSchema = z
  .object({
    provider: z.enum(['recall', 'browser']),
    title: z.string().trim().min(1).max(120).optional(),
    meetingUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => meetingPlatform(value) !== null, {
        message: 'Use a Google Meet, Zoom, or Teams link',
      })
      .optional(),
    joinAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((value) => value.provider === 'browser' || value.meetingUrl, {
    message: 'A meeting link is required for the notetaker bot',
    path: ['meetingUrl'],
  });

export const highlightSchema = z.object({
  id: z.string().uuid(),
  at: z.string().datetime(),
  note: z.string().max(100),
});
export type Highlight = z.infer<typeof highlightSchema>;
export const createHighlightSchema = z
  .object({ note: z.string().trim().max(100).default('') })
  .strict();

export const notetakerSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(['recall', 'browser']),
  meetingId: z.string().uuid().nullable(),
  meetingUrl: z.string().nullable(),
  platform: meetingPlatformSchema,
  title: z.string(),
  calendarEventId: z.string().nullable(),
  joinAt: z.string(),
  status: notetakerStatusSchema,
  statusDetail: z.string().nullable(),
  recordingStartedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  highlights: z.array(highlightSchema),
  /** Server time when this response was made, so clients can time the call. */
  serverTime: z.string(),
});
export type Notetaker = z.infer<typeof notetakerSchema>;

export const capabilitiesSchema = z.object({
  bot: z.boolean(),
  calendar: z.boolean(),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  meetingUrl: z.string().nullable(),
  platform: meetingPlatformSchema.nullable(),
  attendees: z.number().int().nonnegative(),
  notetaker: notetakerSchema.nullable(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarStateSchema = z.object({
  connected: z.boolean(),
  email: z.string().nullable(),
  autoRecord: z.boolean(),
  events: z.array(calendarEventSchema),
});
export type CalendarState = z.infer<typeof calendarStateSchema>;

// Recall.ai's JSON transcript download: one entry per uninterrupted turn.
const recallTimestampSchema = z.object({ relative: z.number().nonnegative() });
export const recallTranscriptSchema = z.array(
  z.object({
    participant: z.object({
      id: z.union([z.number(), z.string()]).nullable().optional(),
      name: z.string().nullable().optional(),
    }),
    words: z.array(
      z.object({
        text: z.string(),
        start_timestamp: recallTimestampSchema,
        end_timestamp: recallTimestampSchema.nullable().optional(),
      }),
    ),
  }),
);

const TURN_MAX_SECONDS = 45;

/**
 * Speaker-labelled segments from a Recall transcript. Turns are kept in time
 * order, never overlap, and split when one speaker talks for a long stretch so
 * transcript links stay precise.
 */
export function recallTranscriptToSegments(value: unknown, duration: number) {
  const turns = recallTranscriptSchema.parse(value);
  const names: Record<string, string> = {};
  const words = turns.flatMap((turn, turnIndex) => {
    const raw = turn.participant.id ?? turn.participant.name ?? `unknown-${turnIndex}`;
    const speakerId = `participant-${String(raw).replace(/[^\w-]/g, '').slice(0, 60) || turnIndex}`;
    const name = turn.participant.name?.trim();
    if (name && !names[speakerId]) names[speakerId] = name.slice(0, 60);
    return turn.words
      .filter((word) => word.text.trim())
      .map((word) => ({
        speakerId,
        text: word.text.trim(),
        start: word.start_timestamp.relative,
        end: Math.max(
          word.end_timestamp?.relative ?? word.start_timestamp.relative + 0.4,
          word.start_timestamp.relative + 0.05,
        ),
      }));
  });
  words.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let current: { speakerId: string; start: number; end: number; text: string[] } | null =
    null;
  const flush = () => {
    if (!current) return;
    const start = Math.max(current.start, segments.at(-1)?.end ?? 0);
    const end = Math.min(current.end, duration);
    if (end > start)
      segments.push({
        id: `segment-${segments.length + 1}`,
        speakerId: current.speakerId,
        start,
        end,
        paragraphs: [current.text.join(' ')],
      });
    current = null;
  };
  for (const word of words) {
    if (
      current &&
      (current.speakerId !== word.speakerId ||
        word.start - current.end > 2 ||
        word.end - current.start > TURN_MAX_SECONDS)
    )
      flush();
    if (!current)
      current = { speakerId: word.speakerId, start: word.start, end: word.end, text: [] };
    current.text.push(word.text);
    current.end = Math.max(current.end, word.end);
  }
  flush();
  const used = new Set(segments.map((segment) => segment.speakerId));
  return {
    segments,
    speakerNames: Object.fromEntries(
      Object.entries(names).filter(([id]) => used.has(id)),
    ),
  };
}

/** Speakers in order of first appearance, with owner-chosen names applied. */
export function transcriptSpeakers(
  segments: { speakerId: string }[] | null,
  names: Record<string, string>,
) {
  const ids = [...new Set((segments ?? []).map((segment) => segment.speakerId))];
  if (!ids.length) ids.push('speaker');
  return ids.map((id, index) => ({
    id,
    name: names[id] || (ids.length === 1 ? 'Speaker' : `Speaker ${index + 1}`),
  }));
}

/** A highlight clicked mid-call covers the half minute that led up to it. */
export const HIGHLIGHT_BEFORE_SECONDS = 25;
export const HIGHLIGHT_AFTER_SECONDS = 5;
export function highlightRange(offsetSeconds: number, duration: number) {
  const at = Math.min(Math.max(0, offsetSeconds), duration);
  const start = Math.max(0, at - HIGHLIGHT_BEFORE_SECONDS);
  const end = Math.min(duration, Math.max(at + HIGHLIGHT_AFTER_SECONDS, start + 1));
  if (end <= start) return null;
  return { startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) };
}
