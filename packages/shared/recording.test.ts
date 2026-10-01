import { describe, expect, it } from 'vitest';
import { fixture } from './reviewer-fixture';
import {
  activeSegment,
  boundedTime,
  momentRange,
  recordingSchema,
} from './recording';

describe('recording contract and timing', () => {
  it('validates the actual imported fixture', () => {
    expect(recordingSchema.safeParse(fixture).success).toBe(true);
  });
  it('rejects overlapping turns, unknown speakers and out-of-bounds timestamps', () => {
    for (const change of [
      { start: 0 },
      { speakerId: 'missing' },
      { end: 999 },
    ]) {
      expect(
        recordingSchema.safeParse({
          ...fixture,
          segments: [
            fixture.segments[0],
            { ...fixture.segments[1], ...change },
          ],
        }).success,
      ).toBe(false);
    }
  });
  it('accepts an empty transcript so the recording remains usable', () => {
    expect(
      recordingSchema.safeParse({ ...fixture, segments: [] }).success,
    ).toBe(true);
  });
  it('requires all three distinct summary templates', () => {
    expect(
      recordingSchema.safeParse({
        ...fixture,
        intelligence: {
          ...fixture.intelligence,
          templates: [
            fixture.intelligence.templates[0],
            fixture.intelligence.templates[0],
            fixture.intelligence.templates[2],
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      new Set(fixture.intelligence.templates.map((template) => template.title))
        .size,
    ).toBe(3);
  });
  it('rejects summary and action citations beyond the recording', () => {
    const general = fixture.intelligence.templates[0];
    expect(
      recordingSchema.safeParse({
        ...fixture,
        intelligence: {
          ...fixture.intelligence,
          templates: [
            {
              ...general,
              sections: [
                {
                  ...general.sections[0],
                  items: [{ ...general.sections[0].items[0], source: 999 }],
                },
                general.sections[1],
              ],
            },
            ...fixture.intelligence.templates.slice(1),
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      recordingSchema.safeParse({
        ...fixture,
        intelligence: {
          ...fixture.intelligence,
          actions: [{ ...fixture.intelligence.actions[0], source: 999 }],
        },
      }).success,
    ).toBe(false);
  });
  it('selects the active speaker at exact boundaries and leaves silence unselected', () => {
    expect(activeSegment(fixture.segments, 0)).toBeNull();
    expect(activeSegment(fixture.segments, 2.7)).toBe('presenter-turn');
    expect(activeSegment(fixture.segments, 97.169)).toBe('presenter-turn');
    expect(activeSegment(fixture.segments, 97.17)).toBe('participant-turn');
    expect(activeSegment(fixture.segments, 103.8)).toBeNull();
  });
  it('clamps seeks to playable bounds', () => {
    expect(boundedTime(-5, 103.8)).toBe(0);
    expect(boundedTime(500, 103.8)).toBe(103.8);
    expect(boundedTime(NaN, 103.8)).toBe(0);
  });
  it('defaults moments to a bounded 30-second range and caps the final moment', () => {
    expect(momentRange(33, 103.8)).toEqual({
      startMs: 33000,
      endMs: 63000,
    });
    expect(momentRange(97.17, 103.8)).toEqual({
      startMs: 97170,
      endMs: 103800,
    });
  });
});
