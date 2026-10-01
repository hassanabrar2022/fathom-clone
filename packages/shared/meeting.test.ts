import { describe, expect, it } from 'vitest';
import { meetings } from '../../tests/support/recording-fixture';
import { formatTime, meetingSchema } from './meeting';

describe('meeting schema', () => {
  it('accepts listed meetings and requires a participant', () => {
    meetings.forEach((meeting) =>
      expect(meetingSchema.safeParse(meeting).success).toBe(true),
    );
    expect(
      meetingSchema.safeParse({ ...meetings[0], participants: [] }).success,
    ).toBe(false);
  });
  it('allows a meeting that has no summary yet', () => {
    expect(meetingSchema.safeParse({ ...meetings[0], summary: '' }).success).toBe(
      true,
    );
  });
});

describe('timestamps', () => {
  it('handles media boundaries, hours, and invalid values', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(59.9)).toBe('0:59');
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(3601)).toBe('1:00:01');
    expect(formatTime(-4)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});
