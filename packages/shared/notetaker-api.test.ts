import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingestionApi } from '../../apps/worker/src/ingestion';
import { verifiedUserHeader } from '../../apps/worker/src/database';
import {
  beginAnalysis,
  checkNotetaker,
  importHighlights,
  importRecording,
  importTranscript,
} from '../../apps/worker/src/capture';
import { planTranscription, transcribePart } from '../../apps/worker/src/processing';
import { apiRequest, createBackend, userA, userB } from '../../tests/support/backend';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Bot = {
  id: string;
  status_changes: { code: string; sub_code?: string | null; created_at: string }[];
  recordings: unknown[];
};

function fakeRecall() {
  const bots = new Map<string, Bot>();
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let transcriptStatus = 'done';
  const transcript = [
    {
      participant: { id: 1, name: 'Ada Lovelace' },
      words: [{ text: 'We ship on Friday.', start_timestamp: { relative: 2 }, end_timestamp: { relative: 5 } }],
    },
    {
      participant: { id: 2, name: 'Grace Hopper' },
      words: [{ text: 'I will write the release notes.', start_timestamp: { relative: 6 }, end_timestamp: { relative: 9 } }],
    },
  ];
  async function handle(request: Request) {
    const url = new URL(request.url);
    if (url.hostname === 'media.example')
      return new Response(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), {
        headers: { 'Content-Length': '8', 'Content-Type': 'video/mp4' },
      });
    if (url.hostname === 'transcripts.example') return Response.json(transcript);
    if (!url.hostname.endsWith('.recall.ai')) throw new Error(`Unexpected ${request.url}`);
    const path = url.pathname.replace('/api/v1/', '');
    const body = request.method === 'POST' ? await request.clone().json().catch(() => undefined) : undefined;
    calls.push({ method: request.method, path, body });
    if (request.headers.get('Authorization') !== 'recall-key')
      return new Response('unauthorized', { status: 401 });
    if (path === 'bot/' && request.method === 'POST') {
      const bot = { id: `bot-${bots.size + 1}`, status_changes: [], recordings: [] };
      bots.set(bot.id, bot);
      return Response.json(bot, { status: 201 });
    }
    const match = /^bot\/([^/]+)\/(leave_call\/)?$/.exec(path);
    const bot = match && bots.get(match[1]);
    if (!bot) return new Response('not found', { status: 404 });
    if (request.method === 'GET') return Response.json(bot);
    if (request.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json(bot);
  }
  return {
    bots,
    calls,
    handle,
    setTranscriptStatus(value: string) {
      transcriptStatus = value;
    },
    /** Moves a bot through a call: joins, records from `start`, finishes. */
    advance(id: string, code: string, at: string) {
      const bot = bots.get(id)!;
      bot.status_changes.push({ code, created_at: at });
      if (code === 'done')
        bot.recordings = [
          {
            id: 'recording-1',
            started_at: '2026-10-01T10:00:00.000Z',
            completed_at: '2026-10-01T10:01:00.000Z',
            media_shortcuts: {
              video_mixed: { data: { download_url: 'https://media.example/video.mp4' } },
              transcript: {
                status: { code: transcriptStatus },
                data: { download_url: 'https://transcripts.example/t.json' },
              },
            },
          },
        ];
    },
  };
}

function setup({ bot = true } = {}) {
  const recall = fakeRecall();
  const backend = createBackend({ meetings: [], external: recall.handle });
  vi.stubGlobal('fetch', backend.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const env = { ...backend.env, ...(bot ? { RECALL_API_KEY: 'recall-key' } : {}) };
  return { backend, recall, env };
}
function as(user: { id: string }, path: string, init: Parameters<typeof apiRequest>[1] = {}) {
  return apiRequest(path, {
    ...init,
    headers: { ...init.headers, [verifiedUserHeader]: user.id },
  });
}

describe('notetaker API', () => {
  it('reports which capture options this server has', async () => {
    const { env } = setup({ bot: false });
    const response = await ingestionApi(as(userA, '/api/capabilities'), env);
    expect(await response.json()).toEqual({ bot: false, calendar: false });
  });

  it('refuses the bot when Recall.ai is not configured', async () => {
    const { env, backend } = setup({ bot: false });
    const response = await ingestionApi(
      as(userA, '/api/notetakers', {
        method: 'POST',
        body: { provider: 'recall', meetingUrl: 'https://meet.google.com/abc-defg-hij' },
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(backend.tables.notetakers).toHaveLength(0);
  });

  it('sends a bot to the call and starts following it', async () => {
    const { env, recall, backend } = setup();
    const response = await ingestionApi(
      as(userA, '/api/notetakers', {
        method: 'POST',
        body: { provider: 'recall', meetingUrl: 'https://meet.google.com/abc-defg-hij', title: 'Roadmap' },
      }),
      env,
    );
    expect(response.status).toBe(201);
    const notetaker = (await response.json()) as { id: string; status: string; platform: string };
    expect(notetaker).toMatchObject({ status: 'joining', platform: 'google_meet' });
    const sent = recall.calls.find((call) => call.method === 'POST')!;
    expect(sent.body).toMatchObject({
      meeting_url: 'https://meet.google.com/abc-defg-hij',
      metadata: { notetaker_id: notetaker.id },
    });
    expect(sent.body).not.toHaveProperty('join_at');
    expect(backend.tables.notetakers[0].external_id).toBe('bot-1');
    expect(env.CAPTURE_MEETING.create).toHaveBeenCalledWith({
      id: `capture-${notetaker.id}`,
      params: { notetakerId: notetaker.id, userId: userA.id },
    });
    const other = await ingestionApi(as(userB, `/api/notetakers/${notetaker.id}`), env);
    expect(other.status).toBe(404);
  });

  it('schedules bots for later meetings and unschedules them on cancel', async () => {
    const { env, recall } = setup();
    const joinAt = new Date(Date.now() + 3600000).toISOString();
    const created = (await (
      await ingestionApi(
        as(userA, '/api/notetakers', {
          method: 'POST',
          body: { provider: 'recall', meetingUrl: 'https://meet.google.com/abc-defg-hij', joinAt },
        }),
        env,
      )
    ).json()) as { id: string; status: string };
    expect(created.status).toBe('scheduled');
    expect(recall.calls[0].body).toMatchObject({ join_at: joinAt });
    const cancelled = await ingestionApi(
      as(userA, `/api/notetakers/${created.id}`, { method: 'DELETE' }),
      env,
    );
    expect(await cancelled.json()).toMatchObject({ status: 'cancelled' });
    expect(recall.calls.at(-1)).toMatchObject({ method: 'DELETE', path: 'bot/bot-1/' });
  });
});

describe('a notetaker bot call, end to end', () => {
  it('records, imports video and named transcript, saves highlights, and starts notes', async () => {
    const { env, recall, backend } = setup();
    const created = (await (
      await ingestionApi(
        as(userA, '/api/notetakers', {
          method: 'POST',
          body: { provider: 'recall', meetingUrl: 'https://meet.google.com/abc-defg-hij', title: 'Launch' },
        }),
        env,
      )
    ).json()) as { id: string };
    const p = { notetakerId: created.id, userId: userA.id };

    const early = await ingestionApi(
      as(userA, `/api/notetakers/${created.id}/highlights`, { method: 'POST', body: {} }),
      env,
    );
    expect(early.status).toBe(409);

    recall.advance('bot-1', 'joining_call', '2026-10-01T09:59:30.000Z');
    recall.advance('bot-1', 'in_waiting_room', '2026-10-01T09:59:40.000Z');
    expect(await checkNotetaker(env, p)).toEqual({ next: 'wait', delay: 15 });
    expect(backend.tables.notetakers[0].status).toBe('waiting_room');

    recall.advance('bot-1', 'in_call_recording', '2026-10-01T10:00:00.000Z');
    expect(await checkNotetaker(env, p)).toEqual({ next: 'wait', delay: 30 });
    expect(backend.tables.notetakers[0]).toMatchObject({
      status: 'recording',
      recording_started_at: '2026-10-01T10:00:00.000Z',
    });

    vi.useFakeTimers({ now: new Date('2026-10-01T10:00:40.000Z'), toFake: ['Date'] });
    const highlighted = await ingestionApi(
      as(userA, `/api/notetakers/${created.id}/highlights`, {
        method: 'POST',
        body: { note: 'Ship date agreed' },
      }),
      env,
    );
    vi.useRealTimers();
    expect(highlighted.status).toBe(201);

    recall.advance('bot-1', 'call_ended', '2026-10-01T10:01:00.000Z');
    recall.advance('bot-1', 'done', '2026-10-01T10:01:05.000Z');
    expect(await checkNotetaker(env, p)).toEqual({ next: 'import' });

    await importRecording(env, p);
    const meeting = backend.tables.meetings[0];
    expect(meeting).toMatchObject({
      id: created.id,
      user_id: userA.id,
      source: 'notetaker',
      media_type: 'video/mp4',
      media_size: 8,
      duration_seconds: 60,
    });
    expect(backend.objects.get(`uploads/${created.id}/media`)?.body).toHaveLength(8);
    // Imports are idempotent across workflow retries.
    await importRecording(env, p);
    expect(backend.tables.meetings).toHaveLength(1);

    await importTranscript(env, p);
    expect(backend.tables.meetings[0]).toMatchObject({
      status: 'analyzing',
      processing_progress: 80,
      speaker_names: { 'participant-1': 'Ada Lovelace', 'participant-2': 'Grace Hopper' },
    });
    expect((backend.tables.meetings[0].transcript as unknown[]).length).toBe(2);

    await importHighlights(env, p);
    expect(backend.tables.meeting_moments).toEqual([
      expect.objectContaining({
        meeting_id: created.id,
        start_ms: 15000,
        end_ms: 45000,
        title: 'Ship date agreed',
      }),
    ]);
    await importHighlights(env, p);
    expect(backend.tables.meeting_moments).toHaveLength(1);

    await beginAnalysis(env, p);
    expect(env.PROCESS_MEETING.create).toHaveBeenCalledOnce();
    expect(backend.tables.notetakers[0].status).toBe('complete');
  });

  it('waits for a transcript that is still being written', async () => {
    const { env, recall } = setup();
    recall.setTranscriptStatus('processing');
    const created = (await (
      await ingestionApi(
        as(userA, '/api/notetakers', {
          method: 'POST',
          body: { provider: 'recall', meetingUrl: 'https://meet.google.com/abc-defg-hij' },
        }),
        env,
      )
    ).json()) as { id: string };
    const p = { notetakerId: created.id, userId: userA.id };
    recall.advance('bot-1', 'in_call_recording', '2026-10-01T10:00:00.000Z');
    recall.advance('bot-1', 'done', '2026-10-01T10:01:00.000Z');
    await importRecording(env, p);
    await expect(importTranscript(env, p)).rejects.toThrow('Transcript still processing');
  });

  it('marks a bot that was never let in as not recorded', async () => {
    const { env, recall, backend } = setup();
    const created = (await (
      await ingestionApi(
        as(userA, '/api/notetakers', {
          method: 'POST',
          body: { provider: 'recall', meetingUrl: 'https://meet.google.com/abc-defg-hij' },
        }),
        env,
      )
    ).json()) as { id: string };
    recall.bots.get('bot-1')!.status_changes.push({
      code: 'call_ended',
      sub_code: 'timeout_exceeded_waiting_room',
      created_at: '2026-10-01T10:20:00.000Z',
    });
    expect(await checkNotetaker(env, { notetakerId: created.id, userId: userA.id })).toEqual({
      next: 'stop',
    });
    expect(backend.tables.notetakers[0]).toMatchObject({
      status: 'failed',
      status_detail: 'Nobody let the notetaker in',
    });
  });
});

describe('recording from the browser', () => {
  it('collects parts during the call and transcribes them in order', async () => {
    const { env, backend } = setup({ bot: false });
    const created = (await (
      await ingestionApi(
        as(userA, '/api/notetakers', { method: 'POST', body: { provider: 'browser', title: 'Standup' } }),
        env,
      )
    ).json()) as { id: string; status: string };
    expect(created.status).toBe('scheduled');
    const notYet = await ingestionApi(
      as(userA, `/api/notetakers/${created.id}/parts`, {
        method: 'POST',
        body: { index: 0, start: 0, duration: 120, size: 2000 },
      }),
      env,
    );
    expect(notYet.status).toBe(409);
    await ingestionApi(as(userA, `/api/notetakers/${created.id}/start`, { method: 'POST' }), env);
    for (const index of [0, 1]) {
      const response = await ingestionApi(
        as(userA, `/api/notetakers/${created.id}/parts`, {
          method: 'POST',
          body: { index, start: index * 120, duration: index ? 30 : 120, size: 2000 },
        }),
        env,
      );
      expect(response.status).toBe(200);
      backend.objects.set(`captures/${created.id}/part-${index}`, {
        body: new Uint8Array(2000) as Uint8Array<ArrayBuffer>,
        type: 'audio/webm',
      });
    }
    await ingestionApi(
      as(userA, `/api/notetakers/${created.id}/highlights`, { method: 'POST', body: {} }),
      env,
    );
    const finished = await ingestionApi(
      as(userA, `/api/notetakers/${created.id}/finish`, {
        method: 'POST',
        body: { size: 5000, duration: 150, contentType: 'audio/webm' },
      }),
      env,
    );
    expect(finished.status).toBe(201);
    const { meetingId, uploadUrl } = (await finished.json()) as { meetingId: string; uploadUrl: string };
    expect(meetingId).toBe(created.id);
    expect(uploadUrl).toContain(`staging/${created.id}/media`);
    expect(backend.tables.meetings[0]).toMatchObject({
      source: 'browser',
      status: 'uploading',
      duration_seconds: 150,
    });
    expect(backend.tables.meeting_moments).toHaveLength(1);
    expect(backend.tables.notetakers[0].status).toBe('complete');

    // Processing reads the parts rather than a whole-file WAV.
    const lease = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    Object.assign(backend.tables.meetings[0], {
      status: 'transcribing',
      processing_progress: 35,
      processing_lease: lease,
      media_uploaded_at: new Date().toISOString(),
    });
    const p = { meetingId, userId: userA.id, lease };
    expect(await planTranscription(env, p)).toEqual({ kind: 'parts', parts: 2, next: 0 });
    env.AI.run
      .mockResolvedValueOnce({ text: 'first', segments: [{ start: 1, end: 4, text: 'First part.' }] })
      .mockResolvedValueOnce({ text: 'second', segments: [{ start: 2, end: 5, text: 'Second part.' }] });
    await transcribePart(env, p, 0);
    await transcribePart(env, p, 0); // a retried step changes nothing
    await transcribePart(env, p, 1);
    expect(backend.tables.meetings[0]).toMatchObject({
      status: 'analyzing',
      processing_progress: 80,
      transcribed_parts: 2,
    });
    expect(
      (backend.tables.meetings[0].transcript as { start: number }[]).map((segment) => segment.start),
    ).toEqual([1, 122]);
    expect(env.AI.run).toHaveBeenCalledTimes(2);
  });
});
