import { describe, expect, test } from 'vitest';

// Both modules are plain JS so scripts/seed.mjs runs with no build step; the
// .d.mts files next to them are what this test type-checks against.
import { buildSeedMeetings, demoAccount } from '../../scripts/seed-data.mjs';
import {
  derivedToken,
  derivedUuid,
  meetingRows,
  silentWav,
} from '../../scripts/seed.mjs';

import { uploadedMeetingSchema } from './ingestion';
import { intelligenceSchema, recordingSchema } from './recording';
import { transcriptSpeakers } from './notetaker';
import { meetingSearchDocumentsSchema, searchMeetingLibrary } from './search';

type Seeded = ReturnType<typeof buildSeedMeetings>[number];
const seeded: Seeded[] = buildSeedMeetings(
  new Date('2026-10-01T12:00:00.000Z'),
);

// Mirrors the column constraints in supabase/migrations: a row the database
// would reject is no use however well it parses.
const DB_LIMITS = {
  title: 120,
  filename: 200,
  momentTitle: 100,
  momentNote: 280,
  momentSpanMs: 60_000,
  durationSeconds: 14_400,
};

test('the library has enough in it to judge the product', () => {
  expect(seeded.length).toBeGreaterThanOrEqual(8);
  expect(new Set(seeded.map((meeting) => meeting.key)).size).toBe(
    seeded.length,
  );
  // The brief singles out the eight-person, hour-long call as the case that
  // matters, so the seed data has to contain one.
  const long = seeded.find(
    (meeting) =>
      Object.keys(meeting.speakerNames).length >= 8 &&
      meeting.durationSeconds >= 3600,
  );
  expect(long, 'an eight-person call of an hour or more').toBeDefined();
});

test('the demo account is a usable sign-in', () => {
  expect(demoAccount.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  expect(demoAccount.password.length).toBeGreaterThanOrEqual(12);
});

describe.each(seeded.map((meeting) => [meeting.key, meeting] as const))(
  '%s',
  (_key, meeting) => {
    const speakers = transcriptSpeakers(meeting.segments, meeting.speakerNames);

    test('parses as a recording the player can render', () => {
      // recordingSchema enforces unique ids, known speakers, and segments that
      // move forward without overlapping or running past the recording.
      const parsed = recordingSchema.safeParse({
        id: `seed-${meeting.key}`,
        mediaUrl: `/api/meetings/seed-${meeting.key}/media`,
        duration: meeting.durationSeconds,
        speakers,
        segments: meeting.segments,
        intelligence: meeting.intelligence,
      });
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.success).toBe(true);
    });

    test('parses as intelligence with all three templates', () => {
      const parsed = intelligenceSchema.safeParse(meeting.intelligence);
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(meeting.intelligence.templates.map((view) => view.key)).toEqual([
        'general',
        'sales-customer',
        'recruiting-interview',
      ]);
    });

    test('every speaker is named, and every segment has a speaker', () => {
      expect(
        speakers.every((speaker) => !/^Speaker( \d+)?$/.test(speaker.name)),
      ).toBe(true);
      const used = new Set(
        meeting.segments.map((segment) => segment.speakerId),
      );
      // An unused cast member would show up in the player's speaker list with
      // nothing attached to it.
      expect([...Object.keys(meeting.speakerNames)].sort()).toEqual(
        [...used].sort(),
      );
    });

    test('every citation lands on the start of a real segment', () => {
      const starts = new Set(meeting.segments.map((segment) => segment.start));
      const cited = [
        ...meeting.intelligence.actions.map((action) => action.source),
        ...meeting.intelligence.templates.flatMap((view) =>
          view.sections.flatMap((section) =>
            section.items.map((item) => item.source),
          ),
        ),
      ];
      expect(cited.length).toBeGreaterThan(0);
      expect(cited.filter((source) => !starts.has(source))).toEqual([]);
    });

    test('transcript pacing is believable', () => {
      // Segments are sized from the words in them. If authored text ever
      // overran a duration the builder would compress it, and the transcript
      // would read as implausibly fast speech.
      for (const segment of meeting.segments) {
        const words = segment.paragraphs
          .join(' ')
          .split(/\s+/)
          .filter(Boolean).length;
        const rate = words / (segment.end - segment.start);
        expect(rate).toBeLessThan(4.2);
      }
      // And the call should be covered rather than bunched at the front.
      expect(meeting.segments.at(-1)!.end).toBeGreaterThan(
        meeting.durationSeconds * 0.9,
      );
    });

    test('the row would satisfy the database constraints', () => {
      expect(meeting.title.length).toBeLessThanOrEqual(DB_LIMITS.title);
      expect(meeting.filename.length).toBeLessThanOrEqual(DB_LIMITS.filename);
      expect(meeting.durationSeconds).toBeLessThanOrEqual(
        DB_LIMITS.durationSeconds,
      );
      expect(['upload', 'notetaker', 'browser']).toContain(meeting.source);
      for (const moment of meeting.moments) {
        expect(moment.title.length).toBeGreaterThan(0);
        expect(moment.title.length).toBeLessThanOrEqual(DB_LIMITS.momentTitle);
        expect(moment.note.length).toBeLessThanOrEqual(DB_LIMITS.momentNote);
        expect(moment.endMs).toBeGreaterThan(moment.startMs);
        expect(moment.endMs - moment.startMs).toBeLessThanOrEqual(
          DB_LIMITS.momentSpanMs,
        );
        expect(moment.endMs).toBeLessThanOrEqual(
          meeting.durationSeconds * 1000,
        );
      }
    });
  },
);

test('the seeded library is searchable the way the app searches it', () => {
  const meetings = seeded.map((meeting) => ({
    id: `seed-${meeting.key}`,
    title: meeting.title,
    date: meeting.createdAt,
    duration: Math.round(meeting.durationSeconds),
    participants: Object.values(meeting.speakerNames) as string[],
    summary:
      meeting.intelligence.templates.find((view) => view.key === 'general')
        ?.overview ?? '',
  }));
  const documents = seeded.map((meeting) => ({
    meetingId: `seed-${meeting.key}`,
    transcript: meeting.segments.map((segment) => ({
      id: segment.id,
      speaker: meeting.speakerNames[segment.speakerId] as string,
      start: segment.start,
      text: segment.paragraphs.join(' '),
    })),
  }));
  expect(meetingSearchDocumentsSchema.safeParse(documents).success).toBe(true);
  // A phrase said in the transcript has to come back with the moment it was
  // said at -- this is the search step in the walkthrough.
  const hits = searchMeetingLibrary(meetings, documents, 'redeliveries');
  expect(hits.length).toBeGreaterThan(0);
  expect(
    hits
      .flatMap((hit) => hit.matches)
      .some((match) => match.kind === 'transcript'),
  ).toBe(true);
  expect(
    searchMeetingLibrary(meetings, documents, 'Brightwell').length,
  ).toBeGreaterThan(0);
  expect(searchMeetingLibrary(meetings, documents, 'zzzznotpresent')).toEqual(
    [],
  );
});

describe('seeding mechanics', () => {
  test('derived ids are valid v4-shaped uuids and stable', () => {
    const a = derivedUuid('user-1', 'q4-roadmap');
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    // Stability is what makes a re-seed replace rows and keep share links alive.
    expect(derivedUuid('user-1', 'q4-roadmap')).toBe(a);
    expect(derivedUuid('user-2', 'q4-roadmap')).not.toBe(a);
    const all = seeded.map((meeting) => derivedUuid('user-1', meeting.key));
    expect(new Set(all).size).toBe(all.length);
  });

  test('derived share tokens match the column constraint', () => {
    // meeting_shares.token and meeting_moments.share_token are both
    // check (token ~ '^[a-f0-9]{64}$').
    const token = derivedToken('user-1', 'q4-roadmap', 'meeting');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(derivedToken('user-1', 'q4-roadmap', 'moment')).not.toBe(token);
  });

  test('the placeholder audio is a WAV of the right length', () => {
    const wav = silentWav(62);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.subarray(12, 16).toString('ascii')).toBe('fmt ');
    expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    const rate = wav.readUInt32LE(24);
    const bits = wav.readUInt16LE(34);
    const dataBytes = wav.readUInt32LE(40);
    // The declared sizes have to agree with the actual buffer, or browsers
    // report a duration that does not match the transcript.
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(dataBytes).toBe(wav.length - 44);
    expect(dataBytes / (rate * (bits / 8))).toBeCloseTo(62, 5);
    // Unsigned 8-bit silence is the midpoint, not zero.
    expect(wav[44]).toBe(0x80);
  });

  test('an hour of placeholder audio stays small enough to upload', () => {
    expect(silentWav(3600).length).toBeLessThan(30 * 1024 * 1024);
  });

  test('the rows written for a meeting satisfy the schema and the columns', () => {
    const meeting = seeded.find((entry) => entry.key === 'q4-roadmap')!;
    const media = silentWav(meeting.durationSeconds);
    const rows = meetingRows(
      meeting,
      '11111111-2222-4333-8444-555555555555',
      media.length,
    );

    expect(rows.meeting.status).toBe('complete');
    // status 'complete' has a check constraint requiring a transcript.
    expect(rows.meeting.transcript).toBe(meeting.segments);
    expect(rows.meeting.storage_key).toBe(`uploads/${rows.id}`);
    expect(rows.meeting.media_size).toBe(media.length);
    expect(rows.meeting.media_size).toBeGreaterThan(0);
    expect(rows.meeting.media_size).toBeLessThanOrEqual(4294967296);
    // Media only serves once media_uploaded_at is set.
    expect(rows.meeting.media_uploaded_at).toBe(meeting.createdAt);
    expect(uploadedMeetingSchema.safeParse(rows.meeting).success).toBe(true);

    expect(rows.moments[0].share_token).toMatch(/^[a-f0-9]{64}$/);
    expect(
      rows.moments.slice(1).every((moment) => moment.share_token === null),
    ).toBe(true);
    expect(rows.share?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(rows.share?.enabled).toBe(true);
  });

  test('without media the row is still insertable but plays nothing', () => {
    const meeting = seeded[0];
    const rows = meetingRows(
      meeting,
      '11111111-2222-4333-8444-555555555555',
      undefined,
    );
    // media_size has check (media_size > 0), so it cannot be zero.
    expect(rows.meeting.media_size).toBe(1);
    expect(rows.meeting.media_uploaded_at).toBeNull();
  });

  test('every meeting gets a shareable moment, and some share the whole meeting', () => {
    const rows = seeded.map((meeting) =>
      meetingRows(meeting, '11111111-2222-4333-8444-555555555555', 1),
    );
    expect(rows.every((row) => row.moments[0]?.share_token)).toBe(true);
    expect(rows.filter((row) => row.share).length).toBeGreaterThanOrEqual(3);
    const tokens = rows.flatMap((row) => [
      row.moments[0].share_token,
      row.share?.token,
    ]);
    const present = tokens.filter(Boolean);
    expect(new Set(present).size).toBe(present.length);
  });
});
