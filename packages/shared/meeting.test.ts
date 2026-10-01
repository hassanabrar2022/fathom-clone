import { describe, expect, it } from 'vitest';
import { meetings } from './reviewer-fixture';
import { filterMeetings, formatTime, meetingSchema } from './meeting';

describe('reviewer dataset', () => {
  it('offers multiple explicitly synthetic meetings with unique routes', () => {
    expect(meetings.length).toBeGreaterThanOrEqual(2);
    expect(new Set(meetings.map((meeting) => meeting.id)).size).toBe(
      meetings.length,
    );
    meetings.forEach((meeting) =>
      expect(meetingSchema.safeParse(meeting).success).toBe(true),
    );
  });
  it('rejects unlabeled data', () => {
    expect(
      meetingSchema.safeParse({ ...meetings[0], provenance: undefined })
        .success,
    ).toBe(false);
  });
});

describe('library filtering', () => {
  it('matches summary context and participants case-insensitively', () => {
    expect(filterMeetings(meetings, ' PILOT ', 'All meetings')).toHaveLength(2);
    expect(filterMeetings(meetings, 'taylor', 'All meetings')[0].id).toBe(
      'customer-discovery',
    );
  });
  it('intersects the selected category with the search', () => {
    expect(filterMeetings(meetings, 'pilot', 'Customer')).toHaveLength(1);
    expect(filterMeetings(meetings, 'pilot', 'Design')).toHaveLength(0);
  });
});

describe('timestamps', () => {
  it('handles media boundaries and invalid values', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(59.9)).toBe('0:59');
    expect(formatTime(3601)).toBe('60:01');
    expect(formatTime(-4)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});
