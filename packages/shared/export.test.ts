import { describe, expect, it } from 'vitest';
import { recording } from '../../tests/support/recording-fixture';
import {
  summaryText,
  transcriptFilename,
  transcriptSegmentText,
  transcriptText,
} from './export';

describe('meeting text exports', () => {
  it('formats the selected summary with citations and action metadata', () => {
    const intelligence = recording.intelligence!;
    const text = summaryText(
      'Pilot planning',
      intelligence.templates[0],
      intelligence.actions,
    );
    expect(text).toContain('Fathom Clone summary · General');
    expect(text).toContain('Key points');
    expect(text).toContain('The team agreed to ship the pilot on Friday. [0:02]');
    expect(text).toContain('- No supported findings in this conversation.');
    expect(text).toContain('Owner: Guest');
    expect(text).toContain('Source: 0:30');
  });

  it('uses current speaker labels and timestamps without altering transcript text', () => {
    const speakers = recording.speakers.map((speaker) =>
      speaker.id === 'host' ? { ...speaker, name: 'Alex' } : speaker,
    );
    const text = transcriptText('Pilot planning', recording.segments, speakers);
    expect(text).toContain('[0:02] Alex');
    expect(text).toContain('[0:30] Guest');
    expect(text).toContain('Let’s ship the pilot on Friday.');
    expect(transcriptSegmentText(recording.segments[1], 'Sam')).toBe(
      '[0:30] Sam\nI will send the revised proposal before then.',
    );
  });

  it('creates a safe, readable transcript filename', () => {
    expect(transcriptFilename('  Q4 Planning / Follow-up!  ')).toBe(
      'q4-planning-follow-up-transcript.txt',
    );
    expect(transcriptFilename('✨')).toBe('meeting-transcript.txt');
  });
});
