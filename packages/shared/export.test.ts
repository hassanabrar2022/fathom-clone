import { describe, expect, it } from 'vitest';
import { fixture as demo } from './reviewer-fixture';
import {
  summaryText,
  transcriptFilename,
  transcriptSegmentText,
  transcriptText,
} from './export';
import { recordingSchema } from './recording';

const recording = recordingSchema.parse(demo);

describe('meeting text exports', () => {
  it('formats the selected summary with citations and action metadata', () => {
    const text = summaryText(
      'From conversation to recording',
      recording.intelligence.templates[0],
      recording.intelligence.actions,
    );
    expect(text).toContain('Fathom Clone summary · General');
    expect(text).toContain('Key points');
    expect(text).toContain('The host starts capture');
    expect(text).toContain('[0:02]');
    expect(text).toContain('Action items');
    expect(text).toContain('Owner: Participant');
    expect(text).toContain('Source: 1:14');
  });

  it('uses current speaker labels and timestamps without altering transcript text', () => {
    const speakers = recording.speakers.map((speaker) =>
      speaker.id === 'presenter' ? { ...speaker, name: 'Alex' } : speaker,
    );
    const text = transcriptText(
      'From conversation to recording',
      recording.segments,
      speakers,
    );
    expect(text).toContain('[0:02] Alex');
    expect(text).toContain('[1:37] Participant');
    expect(text).toContain("If you don't, you'll see a Fathom panel");
    expect(transcriptSegmentText(recording.segments[1], 'Guest')).toBe(
      '[1:37] Guest\nBut my video is not getting recorded. Okay, let me end this meeting.',
    );
  });

  it('creates a safe, readable transcript filename', () => {
    expect(transcriptFilename('  Q4 Planning / Follow-up!  ')).toBe(
      'q4-planning-follow-up-transcript.txt',
    );
    expect(transcriptFilename('✨')).toBe('meeting-transcript.txt');
  });
});
