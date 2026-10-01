import { describe, expect, it } from 'vitest';
import {
  canTransition, createUploadSchema, normalizeTranscription,
  retryStage, storedTranscriptSchema, uploadLimits,
} from './ingestion';

const validUpload = {
  title: 'Assessment conversation', filename: 'meeting.webm',
  contentType: 'video/webm', size: 2048, duration: 104,
};

describe('real ingestion boundaries', () => {
  it('validates supported media and rejects paths, unsupported types, and oversized files', () => {
    expect(createUploadSchema.safeParse(validUpload).success).toBe(true);
    for (const override of [
      { filename: '../private.webm' }, { filename: 'folder\\meeting.webm' },
      { contentType: 'text/html' }, { size: uploadLimits.bytes + 1 },
      { size: 0 }, { duration: uploadLimits.seconds + 1 },
      { duration: Number.NaN }, { title: ' ' }, { owner: 'another-user' },
    ]) {
      expect(createUploadSchema.safeParse({ ...validUpload, ...override }).success).toBe(false);
    }
  });

  it('preserves actual speech timestamps and clamps a rounded last segment to the media end', () => {
    const segments = normalizeTranscription({
      text: 'We agreed. Next step.',
      segments: [
        { start: 2.7, end: 9.1, text: ' We agreed. ' },
        { start: 97.17, end: 104.2, text: 'Next step.' },
      ],
    }, 103.8);
    expect(segments.map(({ start, end }) => [start, end])).toEqual([[2.7, 9.1], [97.17, 103.8]]);
    expect(segments[0].paragraphs).toEqual(['We agreed.']);
    expect(segments.every((segment) => segment.speakerId === 'speaker')).toBe(true);
  });

  it('retains a valid empty transcript without manufacturing speech or timestamps', () => {
    expect(normalizeTranscription({ text: '', segments: [] }, 30)).toEqual([]);
    expect(() => normalizeTranscription({ text: 'Speech', segments: [] }, 30)).toThrow();
    expect(() => normalizeTranscription({ text: 'Speech' }, 30)).toThrow();
  });

  it('normalizes small provider overlaps and rejects invalid stored transcript identities', () => {
    const segments = normalizeTranscription({ text: 'One two', segments: [
      { start: 0, end: 4, text: 'One' }, { start: 3.99, end: 8, text: 'Two' },
    ] }, 10);
    expect(segments[1].start).toBe(4);
    expect(storedTranscriptSchema.safeParse([segments[0], segments[0]]).success).toBe(false);
  });

  it('prevents skipping processing steps and retries analysis without losing the transcript', () => {
    expect(canTransition('uploading', 'complete')).toBe(false);
    expect(canTransition('uploaded', 'analyzing')).toBe(false);
    expect(canTransition('complete', 'transcribing')).toBe(false);
    expect(canTransition('transcribing', 'analyzing')).toBe(true);
    expect(canTransition('analyzing', 'failed')).toBe(true);
    expect(retryStage(true, true)).toBe('analyzing');
    expect(retryStage(true, false)).toBe('transcribing');
    expect(retryStage(false, false)).toBe('uploading');
  });
});
