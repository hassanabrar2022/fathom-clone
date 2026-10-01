import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LeaseLost,
  analyzeMeeting,
  failProcessing,
  finishProcessing,
  planTranscription,
  storeUpload,
  transcribeChunk,
  transcribeWhole,
  type ProcessParams,
} from '../../apps/worker/src/processing';
import { createBackend, meetingRow, userA } from '../../tests/support/backend';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const id = '66666666-6666-4666-8666-666666666666';
const lease = '99999999-9999-4999-8999-999999999999';
const params: ProcessParams = { meetingId: id, userId: userA.id, lease };

function setup(
  row: Record<string, unknown>,
  objects: NonNullable<Parameters<typeof createBackend>[0]>['objects'] = {},
) {
  const backend = createBackend({
    meetings: [
      meetingRow({
        id,
        status: 'transcribing',
        processing_progress: 35,
        processing_lease: lease,
        media_uploaded_at: null,
        transcript: null,
        ...row,
      }),
    ],
    objects,
  });
  vi.stubGlobal('fetch', backend.fetch);
  return { backend, row: () => backend.tables.meetings[0] };
}

/** A valid mono 16 kHz, 16-bit PCM WAV of the given length. */
function wav(seconds: number) {
  const dataBytes = seconds * 16000 * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const label = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  label(0, 'RIFF');
  view.setUint32(4, dataBytes + 36, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, dataBytes, true);
  return { body: bytes, type: 'audio/wav' };
}
const speech = (text: string, start = 1, end = 4) => ({
  text,
  segments: [{ start, end, text }],
});

describe('storing the upload', () => {
  it('copies the verified staging object to the meeting key', async () => {
    const { backend, row } = setup(
      {},
      { [`staging/${id}/media`]: { body: new Uint8Array(4), type: 'video/webm' } },
    );
    await storeUpload(backend.env, params);
    expect(backend.objects.has(`uploads/${id}/media`)).toBe(true);
    expect(backend.objects.has(`staging/${id}/media`)).toBe(false);
    expect(row().media_uploaded_at).toEqual(expect.any(String));
  });

  it('rejects a staging object that does not match the reservation', async () => {
    const { backend } = setup(
      {},
      { [`staging/${id}/media`]: { body: new Uint8Array(9), type: 'video/webm' } },
    );
    await expect(storeUpload(backend.env, params)).rejects.toThrow(/does not match/);
  });

  it('is a no-op once the media is stored', async () => {
    const { backend } = setup({ media_uploaded_at: '2026-09-30T10:00:00Z' });
    await storeUpload(backend.env, params);
    expect(backend.log.some((call) => call.url.includes('r2.'))).toBe(false);
  });

  it('stops when another run holds the lease', async () => {
    const { backend } = setup({ processing_lease: crypto.randomUUID() });
    await expect(storeUpload(backend.env, params)).rejects.toBeInstanceOf(LeaseLost);
  });
});

describe('transcription', () => {
  it('plans whole-file transcription for short recordings', async () => {
    const { backend } = setup({ duration_seconds: 90 });
    expect(await planTranscription(backend.env, params)).toEqual({ kind: 'whole' });
  });

  it('skips transcription once a transcript is saved', async () => {
    const { backend } = setup({ processing_progress: 80, transcript: [] });
    expect(await planTranscription(backend.env, params)).toEqual({ kind: 'done' });
  });

  it('saves a timestamped transcript and moves on to analysis', async () => {
    const { backend, row } = setup(
      { duration_seconds: 30, media_uploaded_at: '2026-09-30T10:00:00Z' },
      { [`uploads/${id}/media`]: { body: new Uint8Array(4), type: 'video/webm' } },
    );
    backend.env.AI.run.mockResolvedValueOnce({
      ...speech('We will ship on Friday.'),
      transcription_info: { duration: 28 },
    });
    await transcribeWhole(backend.env, params);
    expect(row()).toMatchObject({
      status: 'analyzing',
      processing_progress: 80,
      duration_seconds: 28,
    });
    expect(row().transcript).toEqual([
      expect.objectContaining({ start: 1, end: 4, paragraphs: ['We will ship on Friday.'] }),
    ]);
  });

  it('completes a recording with no speech without analysis', async () => {
    const { backend, row } = setup(
      { media_uploaded_at: '2026-09-30T10:00:00Z' },
      { [`uploads/${id}/media`]: { body: new Uint8Array(4), type: 'video/webm' } },
    );
    backend.env.AI.run.mockResolvedValueOnce({ text: '', segments: [] });
    await transcribeWhole(backend.env, params);
    expect(row()).toMatchObject({ status: 'complete', processing_progress: 100, transcript: [] });
  });

  it('transcribes long audio in two-minute parts with source timestamps', async () => {
    const { backend, row } = setup(
      { duration_seconds: 130, media_uploaded_at: '2026-09-30T10:00:00Z' },
      { [`staging/${id}/audio`]: wav(130) },
    );
    const plan = await planTranscription(backend.env, params);
    expect(plan).toMatchObject({ kind: 'chunks', chunks: 2, next: 0 });
    expect(backend.objects.has(`uploads/${id}/audio-media`)).toBe(true);
    expect(backend.objects.has(`staging/${id}/audio`)).toBe(false);
    if (plan.kind !== 'chunks') throw new Error('expected chunks');

    backend.env.AI.run
      .mockResolvedValueOnce(speech('First part.'))
      .mockResolvedValueOnce(speech('Second part.', 2, 5));
    await transcribeChunk(backend.env, params, 0, plan.audioSize, plan.chunks);
    expect(row()).toMatchObject({ status: 'transcribing', processing_progress: 58 });
    // A retried step finds its part already saved and does no model work.
    await transcribeChunk(backend.env, params, 0, plan.audioSize, plan.chunks);
    expect(backend.env.AI.run).toHaveBeenCalledTimes(1);

    await transcribeChunk(backend.env, params, 1, plan.audioSize, plan.chunks);
    expect(row()).toMatchObject({ status: 'analyzing', processing_progress: 80 });
    expect(row().transcript).toEqual([
      expect.objectContaining({ id: 'segment-1', start: 1, end: 4 }),
      expect.objectContaining({ id: 'segment-2', start: 122, end: 125 }),
    ]);
    const resumed = await planTranscription(backend.env, params);
    expect(resumed).toEqual({ kind: 'done' });
  });

  it('rejects transcription audio whose length disagrees with the recording', async () => {
    const { backend } = setup(
      { duration_seconds: 300 },
      { [`staging/${id}/audio`]: wav(130) },
    );
    await expect(planTranscription(backend.env, params)).rejects.toThrow(
      /duration mismatch/,
    );
  });
});

describe('analysis and completion', () => {
  const view = (overview: string) => ({
    title: overview,
    overview,
    sections: [
      { title: 'Decisions', items: [{ text: 'Ship Friday', source: 1 }] },
      { title: 'Open questions', items: [] },
    ],
  });
  const analysis = {
    general: view('A planning conversation.'),
    sales_customer: view('No customer evidence is present.'),
    recruiting_interview: view('No hiring evidence is present.'),
    actions: [
      { id: 'a1', task: 'Send proposal', owner: null, timing: 'Friday', source: 2 },
    ],
  };
  const transcribed = {
    status: 'analyzing',
    processing_progress: 80,
    media_uploaded_at: '2026-09-30T10:00:00Z',
    transcript: meetingRow().transcript,
  };

  it('stores three distinct summary views and sourced actions', async () => {
    const { backend, row } = setup(transcribed);
    backend.env.AI.run.mockResolvedValueOnce({ response: JSON.stringify(analysis) });
    await analyzeMeeting(backend.env, params);
    const intelligence = row().intelligence as {
      templates: { key: string }[];
      actions: unknown[];
    };
    expect(intelligence.templates.map((t) => t.key)).toEqual([
      'general',
      'sales-customer',
      'recruiting-interview',
    ]);
    expect(intelligence.actions).toHaveLength(1);
  });

  it('retries once with a correction, then fails on unusable output', async () => {
    const { backend, row } = setup(transcribed);
    backend.env.AI.run.mockResolvedValue({ response: '{"not":"valid"}' });
    await expect(analyzeMeeting(backend.env, params)).rejects.toThrow(
      /Analysis unavailable/,
    );
    expect(backend.env.AI.run).toHaveBeenCalledTimes(2);
    expect(row().intelligence).toBeNull();
  });

  it('rejects citations past the end of the recording', async () => {
    const { backend } = setup(transcribed);
    const late = {
      ...analysis,
      actions: [{ ...analysis.actions[0], source: 999 }],
    };
    backend.env.AI.run.mockResolvedValue({ response: late });
    await expect(analyzeMeeting(backend.env, params)).rejects.toThrow();
  });

  it('finishes by releasing the lease', async () => {
    const { backend, row } = setup(transcribed);
    await finishProcessing(backend.env, params);
    expect(row()).toMatchObject({
      status: 'complete',
      processing_progress: 100,
      processing_lease: null,
    });
  });

  it('records a failure, and ignores it once the lease has moved on', async () => {
    const first = setup(transcribed);
    await failProcessing(first.backend.env, params, 'analysis_failed');
    expect(first.row()).toMatchObject({
      status: 'failed',
      processing_error: 'analysis_failed',
      processing_lease: null,
    });

    const superseded = setup({ ...transcribed, processing_lease: crypto.randomUUID() });
    await expect(
      failProcessing(superseded.backend.env, params, 'analysis_failed'),
    ).resolves.toBe(true);
    expect(superseded.row().status).toBe('analyzing');
  });
});
