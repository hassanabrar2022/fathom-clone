import { describe, expect, it } from 'vitest';
import {
  createNotetakerSchema,
  findMeetingLink,
  highlightRange,
  meetingPlatform,
  recallTranscriptToSegments,
  transcriptSpeakers,
} from './notetaker';

const word = (text: string, start: number, end: number) => ({
  text,
  start_timestamp: { relative: start },
  end_timestamp: { relative: end },
});

describe('meeting links', () => {
  it('recognizes Meet, Zoom, and Teams links only', () => {
    expect(meetingPlatform('https://meet.google.com/abc-defg-hij')).toBe('google_meet');
    expect(meetingPlatform('https://us02web.zoom.us/j/123456789?pwd=x')).toBe('zoom');
    expect(
      meetingPlatform('https://teams.microsoft.com/l/meetup-join/19%3ameeting/0'),
    ).toBe('teams');
    expect(meetingPlatform('https://meet.google.com/landing')).toBeNull();
    expect(meetingPlatform('http://meet.google.com/abc-defg-hij')).toBeNull();
    expect(meetingPlatform('https://evil.example/meet.google.com/abc-defg-hij')).toBeNull();
    expect(meetingPlatform('not a link')).toBeNull();
  });

  it('finds the meeting link inside an invitation', () => {
    expect(
      findMeetingLink(
        null,
        'Agenda: roadmap.\nJoin Zoom Meeting https://acme.zoom.us/j/98765?pwd=abc\nThanks',
      ),
    ).toBe('https://acme.zoom.us/j/98765?pwd=abc');
    expect(findMeetingLink('Room 4', 'No link here')).toBeNull();
  });

  it('requires a meeting link for the bot but not for browser capture', () => {
    expect(createNotetakerSchema.safeParse({ provider: 'recall' }).success).toBe(false);
    expect(createNotetakerSchema.safeParse({ provider: 'browser' }).success).toBe(true);
    expect(
      createNotetakerSchema.safeParse({
        provider: 'recall',
        meetingUrl: 'https://example.com/call',
      }).success,
    ).toBe(false);
  });
});

describe('Recall transcripts', () => {
  it('keeps named speakers, time order, and non-overlapping turns', () => {
    const { segments, speakerNames } = recallTranscriptToSegments(
      [
        { participant: { id: 100, name: 'Ada Lovelace' }, words: [word('Let’s', 1, 1.4), word('start.', 1.4, 2)] },
        { participant: { id: 200, name: 'Grace Hopper' }, words: [word('Agreed,', 1.8, 2.6), word('go ahead.', 2.6, 3.4)] },
        { participant: { id: 100, name: 'Ada Lovelace' }, words: [word('Budget first.', 4, 5)] },
      ],
      60,
    );
    expect(segments.map((segment) => [segment.speakerId, segment.paragraphs[0]])).toEqual([
      ['participant-100', 'Let’s start.'],
      ['participant-200', 'Agreed, go ahead.'],
      ['participant-100', 'Budget first.'],
    ]);
    for (let index = 1; index < segments.length; index++)
      expect(segments[index].start).toBeGreaterThanOrEqual(segments[index - 1].end);
    expect(speakerNames).toEqual({
      'participant-100': 'Ada Lovelace',
      'participant-200': 'Grace Hopper',
    });
  });

  it('splits one long monologue so transcript links stay precise', () => {
    const words = Array.from({ length: 100 }, (_, index) => word(`w${index}`, index, index + 0.9));
    const { segments } = recallTranscriptToSegments(
      [{ participant: { id: 1, name: 'Host' }, words }],
      200,
    );
    expect(segments.length).toBeGreaterThan(2);
    expect(segments.every((segment) => segment.end - segment.start <= 46)).toBe(true);
  });

  it('clips words past the recording’s end and ignores empty words', () => {
    const { segments } = recallTranscriptToSegments(
      [{ participant: { id: 1, name: null }, words: [word(' ', 0, 1), word('late', 9, 12)] }],
      10,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].end).toBe(10);
  });
});

describe('speakers and highlights', () => {
  it('numbers unnamed speakers and applies owner names', () => {
    const segments = [{ speakerId: 'a' }, { speakerId: 'b' }, { speakerId: 'a' }];
    expect(transcriptSpeakers(segments, { b: 'Bea' })).toEqual([
      { id: 'a', name: 'Speaker 1' },
      { id: 'b', name: 'Bea' },
    ]);
    expect(transcriptSpeakers(null, {})).toEqual([{ id: 'speaker', name: 'Speaker' }]);
  });

  it('covers the half minute before a mid-call highlight', () => {
    expect(highlightRange(100, 600)).toEqual({ startMs: 75000, endMs: 105000 });
    expect(highlightRange(10, 600)).toEqual({ startMs: 0, endMs: 15000 });
    expect(highlightRange(598, 600)).toEqual({ startMs: 573000, endMs: 600000 });
  });
});
