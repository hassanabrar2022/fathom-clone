import { describe, expect, it } from 'vitest';
import { recording } from '../../tests/support/recording-fixture';
import {
  activeSegment,
  boundedTime,
  intelligenceSchema,
  momentRange,
  recordingSchema,
} from './recording';

describe('recording contract and timing', () => {
  it('validates a well-formed recording', () => {
    expect(recordingSchema.safeParse(recording).success).toBe(true);
  });
  it('rejects overlapping turns, unknown speakers and out-of-bounds timestamps', () => {
    for (const change of [{ start: 0 }, { speakerId: 'missing' }, { end: 999 }]) {
      expect(
        recordingSchema.safeParse({
          ...recording,
          segments: [
            recording.segments[0],
            { ...recording.segments[1], ...change },
          ],
        }).success,
      ).toBe(false);
    }
  });
  it('accepts an empty transcript and missing analysis so playback stays usable', () => {
    expect(
      recordingSchema.safeParse({ ...recording, segments: [], intelligence: null })
        .success,
    ).toBe(true);
  });
  it('requires exactly three summary templates from a live model', () => {
    const intelligence = recording.intelligence!;
    expect(
      intelligenceSchema.safeParse({
        ...intelligence,
        templates: intelligence.templates.slice(0, 2),
      }).success,
    ).toBe(false);
    expect(
      intelligenceSchema.safeParse({ ...intelligence, provenance: 'prepared-demo' })
        .success,
    ).toBe(false);
  });
  it('selects the active speaker at exact boundaries and leaves silence unselected', () => {
    expect(activeSegment(recording.segments, 0)).toBeNull();
    expect(activeSegment(recording.segments, 2)).toBe('host-turn');
    expect(activeSegment(recording.segments, 29.99)).toBe('host-turn');
    expect(activeSegment(recording.segments, 30)).toBe('guest-turn');
    expect(activeSegment(recording.segments, 58)).toBeNull();
  });
  it('clamps seeks to playable bounds', () => {
    expect(boundedTime(-5, 60)).toBe(0);
    expect(boundedTime(500, 60)).toBe(60);
    expect(boundedTime(NaN, 60)).toBe(0);
  });
  it('defaults moments to a bounded 30-second range and caps the final moment', () => {
    expect(momentRange(10, 60)).toEqual({ startMs: 10000, endMs: 40000 });
    expect(momentRange(50, 60)).toEqual({ startMs: 50000, endMs: 60000 });
  });
});
